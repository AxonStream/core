"""
AxonPuls Python Client with Multi-Tenancy Support and Advanced Features
Enhanced version with circuit breaker, exponential backoff, and comprehensive error handling
"""
import asyncio
import json
import jwt
import websockets
import logging
from typing import Dict, List, Optional, Callable, Any, Union
from datetime import datetime, timedelta
from enum import Enum
import aiohttp
from dataclasses import dataclass, field

from .types import (
    AxonPulsEvent,
    AxonPulsClientConfig,
    SubscribeOptions,
    PublishOptions,
    ConnectionState,
    EventHandler,
)
from .errors import (
    AxonPulsError,
    AxonPulsConnectionError,
    AxonPulsAuthenticationError,
    AxonPulsValidationError,
    AxonPulsTenantIsolationError,
)

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreaker:
    failure_threshold: int = 5
    timeout_seconds: int = 60
    failure_count: int = 0
    state: CircuitState = CircuitState.CLOSED
    last_failure_time: Optional[datetime] = None

    def record_success(self):
        """Record a successful operation"""
        self.failure_count = 0
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED

    def record_failure(self):
        """Record a failed operation"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

    def can_attempt(self) -> bool:
        """Check if an operation can be attempted"""
        if self.state == CircuitState.CLOSED:
            return True
        elif self.state == CircuitState.OPEN:
            if (self.last_failure_time and 
                datetime.now() - self.last_failure_time > timedelta(seconds=self.timeout_seconds)):
                self.state = CircuitState.HALF_OPEN
                return True
            return False
        else:  # HALF_OPEN
            return True


class AxonPulsClient:
    """Advanced AxonPuls client with multi-tenancy, circuit breaker, and comprehensive error handling"""
    
    # Constants
    MAX_PAYLOAD_BYTES = 1048576  # 1MB
    MAX_CHANNELS = 200
    HEARTBEAT_INTERVAL = 30
    BACKOFF_BASE_MS = 250
    BACKOFF_FACTOR = 2
    BACKOFF_MAX_MS = 30000
    BACKOFF_JITTER = 0.2
    
    def __init__(self, config: AxonPulsClientConfig):
        self.config = config
        self.org_id = self._extract_org_id_from_token(config.token)
        if not self.org_id:
            raise AxonPulsValidationError("Token must contain organizationId claim for multi-tenancy")
        
        # Connection state
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.subscriptions: set[str] = set()
        self.event_handlers: Dict[str, List[EventHandler]] = {}
        self.connection_state = ConnectionState.DISCONNECTED
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._reconnect_task: Optional[asyncio.Task] = None
        
        # Advanced features
        self.circuit_breaker = CircuitBreaker()
        self.reconnect_attempt = 0
        self.last_pong_time = datetime.now()
        self.missed_pongs = 0
        self.last_stream_ids: Dict[str, str] = {}
        
        # HTTP client for REST API calls
        self.http_session: Optional[aiohttp.ClientSession] = None
        
        logger.info(f"AxonPuls client initialized for organization: {self.org_id}")
    
    def _extract_org_id_from_token(self, token: str) -> Optional[str]:
        """Extract organization ID from JWT token"""
        try:
            # Decode without verification for org_id extraction
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload.get("organizationId")
        except Exception as e:
            logger.error(f"Failed to extract organizationId from token: {e}")
            return None
    
    def _validate_channel(self, channel: str) -> bool:
        """Validate that channel belongs to this organization"""
        expected_prefix = f"org:{self.org_id}:"
        if not channel.startswith(expected_prefix):
            raise AxonPulsTenantIsolationError(
                f"Channel '{channel}' not in your organization. "
                f"Use format: {expected_prefix}<channel_name>"
            )
        return True
    
    def _validate_payload_size(self, payload: Any) -> bool:
        """Validate payload size doesn't exceed limits"""
        try:
            payload_json = json.dumps(payload)
            size = len(payload_json.encode('utf-8'))
            if size > self.MAX_PAYLOAD_BYTES:
                raise AxonPulsValidationError(
                    f"Payload size ({size} bytes) exceeds maximum ({self.MAX_PAYLOAD_BYTES} bytes)"
                )
            return True
        except (TypeError, ValueError) as e:
            raise AxonPulsValidationError(f"Invalid payload: {e}")
    
    async def connect(self) -> None:
        """Connect to AxonPuls gateway with circuit breaker protection"""
        if self.connection_state in [ConnectionState.CONNECTED, ConnectionState.CONNECTING]:
            return
        
        if not self.circuit_breaker.can_attempt():
            wait_time = self.circuit_breaker.timeout_seconds
            raise AxonPulsConnectionError(f"Circuit breaker open. Retry after {wait_time}s")
        
        self.connection_state = ConnectionState.CONNECTING
        
        try:
            # Initialize HTTP session if not exists
            if not self.http_session:
                self.http_session = aiohttp.ClientSession(
                    headers={"Authorization": f"Bearer {self.config.token}"}
                )
            
            # Connect WebSocket
            headers = {
                "Authorization": f"Bearer {self.config.token}",
                "User-Agent": f"AxonPuls-python/{self.config.client_type or 'default'}"
            }
            
            self.websocket = await websockets.connect(
                self.config.url,
                extra_headers=headers,
                ping_interval=self.config.heartbeat_interval or self.HEARTBEAT_INTERVAL,
                ping_timeout=10,
                max_size=self.MAX_PAYLOAD_BYTES,
            )
            
            self.connection_state = ConnectionState.CONNECTED
            self.circuit_breaker.record_success()
            self.reconnect_attempt = 0
            
            logger.info(f"Connected to AxonPuls for org {self.org_id}")
            
            # Start message handler and heartbeat
            asyncio.create_task(self._message_handler())
            
            if self.config.heartbeat_interval and self.config.heartbeat_interval > 0:
                self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            
        except Exception as e:
            self.connection_state = ConnectionState.DISCONNECTED
            self.circuit_breaker.record_failure()
            logger.error(f"Failed to connect: {e}")
            raise AxonPulsConnectionError(f"Connection failed: {e}")
    
    async def disconnect(self) -> None:
        """Disconnect from AxonPuls gateway"""
        self.connection_state = ConnectionState.DISCONNECTED
        
        # Cancel background tasks
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        
        if self._reconnect_task:
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass
        
        # Close WebSocket
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
        
        # Close HTTP session
        if self.http_session:
            await self.http_session.close()
            self.http_session = None
            
        logger.info(f"Disconnected from AxonPuls for org {self.org_id}")
    
    async def subscribe(self, channels: List[str], options: Optional[SubscribeOptions] = None) -> None:
        """Subscribe to channels with org validation and limits checking"""
        if self.connection_state != ConnectionState.CONNECTED:
            raise AxonPulsConnectionError("Not connected to AxonPuls gateway")
        
        # Validate channel limits
        if len(channels) + len(self.subscriptions) > self.MAX_CHANNELS:
            raise AxonPulsValidationError(f"Maximum channel subscriptions ({self.MAX_CHANNELS}) exceeded")
        
        # Validate all channels belong to this org
        for channel in channels:
            self._validate_channel(channel)
        
        message = {
            "id": self._generate_id(),
            "type": "subscribe",
            "payload": {
                "channels": channels,
                "options": options.__dict__ if options else {}
            },
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        
        await self._send_message(message)
        self.subscriptions.update(channels)
        
        logger.info(f"Subscribed to channels: {channels}")
    
    async def unsubscribe(self, channels: List[str]) -> None:
        """Unsubscribe from channels"""
        if self.connection_state != ConnectionState.CONNECTED:
            raise AxonPulsConnectionError("Not connected to AxonPuls gateway")
        
        for channel in channels:
            self._validate_channel(channel)
        
        message = {
            "id": self._generate_id(),
            "type": "unsubscribe",
            "payload": {"channels": channels},
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        
        await self._send_message(message)
        self.subscriptions.difference_update(channels)
        
        logger.info(f"Unsubscribed from channels: {channels}")
    
    async def publish(
        self, 
        channel: str, 
        event_type: str, 
        payload: Any,
        correlation_id: Optional[str] = None,
        options: Optional[PublishOptions] = None
    ) -> None:
        """Publish event to channel with validation and size checks"""
        if self.connection_state != ConnectionState.CONNECTED:
            raise AxonPulsConnectionError("Not connected to AxonPuls gateway")
        
        self._validate_channel(channel)
        self._validate_payload_size(payload)
        
        event = AxonPulsEvent(
            id=self._generate_id(),
            type=event_type,
            payload=payload,
            timestamp=int(datetime.now().timestamp() * 1000),
            metadata={
                "correlation_id": correlation_id or self._generate_id(),
                "org_id": self.org_id,
                "channel": channel,
            }
        )
        
        message = {
            "id": self._generate_id(),
            "type": "publish",
            "payload": {
                "channel": channel,
                "event": event.__dict__,
                "options": options.__dict__ if options else {}
            },
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        
        await self._send_message(message)
        logger.debug(f"Published {event_type} to {channel}")
    
    async def replay(
        self, 
        channel: str, 
        since_id: Optional[str] = None, 
        count: int = 100
    ) -> None:
        """Replay events from channel"""
        if self.connection_state != ConnectionState.CONNECTED:
            raise AxonPulsConnectionError("Not connected to AxonPuls gateway")
        
        self._validate_channel(channel)
        
        message = {
            "id": self._generate_id(),
            "type": "replay",
            "payload": {
                "channel": channel,
                "sinceId": since_id,
                "count": count
            },
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        
        await self._send_message(message)
        logger.info(f"Requested replay for {channel}")
    
    def on(self, event_type: str, handler: EventHandler) -> None:
        """Register event handler"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
    
    def off(self, event_type: str, handler: Optional[EventHandler] = None) -> None:
        """Unregister event handler"""
        if event_type in self.event_handlers:
            if handler:
                try:
                    self.event_handlers[event_type].remove(handler)
                except ValueError:
                    pass
            else:
                del self.event_handlers[event_type]
    
    async def _send_message(self, message: Dict[str, Any]) -> None:
        """Send message to gateway with error handling"""
        if not self.websocket or self.connection_state != ConnectionState.CONNECTED:
            raise AxonPulsConnectionError("Not connected to AxonPuls gateway")
        
        try:
            await self.websocket.send(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            self.circuit_breaker.record_failure()
            raise AxonPulsConnectionError(f"Failed to send message: {e}")
    
    async def _message_handler(self) -> None:
        """Handle incoming messages with comprehensive error handling"""
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse message: {e}")
                except Exception as e:
                    logger.error(f"Error handling message: {e}")
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
            self.connection_state = ConnectionState.DISCONNECTED
            
            if self.config.auto_reconnect:
                self._reconnect_task = asyncio.create_task(self._reconnect())
        except Exception as e:
            logger.error(f"Message handler error: {e}")
            if self.config.auto_reconnect:
                self._reconnect_task = asyncio.create_task(self._reconnect())
    
    async def _handle_message(self, data: Dict[str, Any]) -> None:
        """Handle parsed message"""
        message_type = data.get("type")
        payload = data.get("payload", {})
        
        # Handle different message types
        if message_type == "event":
            event_type = payload.get("type")
            
            # Track stream IDs for replay
            if (payload.get("metadata", {}).get("channel") and 
                payload.get("metadata", {}).get("stream_entry_id")):
                channel = payload["metadata"]["channel"]
                stream_id = payload["metadata"]["stream_entry_id"]
                self.last_stream_ids[channel] = stream_id
            
            # Emit to registered handlers
            if event_type in self.event_handlers:
                for handler in self.event_handlers[event_type]:
                    try:
                        if asyncio.iscoroutinefunction(handler):
                            await handler(payload)
                        else:
                            handler(payload)
                    except Exception as e:
                        logger.error(f"Error in event handler: {e}")
        
        elif message_type == "ack":
            logger.debug(f"Received acknowledgment: {data}")
        
        elif message_type == "error":
            error = payload.get("error", {})
            logger.error(f"Received error: {error}")
            # Could emit error events here
        
        elif message_type == "pong":
            self.last_pong_time = datetime.now()
            self.missed_pongs = 0
            logger.debug("Received pong")
    
    async def _heartbeat_loop(self) -> None:
        """Send periodic heartbeat with liveness checking"""
        while self.connection_state == ConnectionState.CONNECTED:
            try:
                await asyncio.sleep(self.config.heartbeat_interval or self.HEARTBEAT_INTERVAL)
                
                if self.connection_state == ConnectionState.CONNECTED:
                    # Check for missed pongs
                    time_since_pong = datetime.now() - self.last_pong_time
                    if time_since_pong.total_seconds() > (self.config.heartbeat_interval or self.HEARTBEAT_INTERVAL) * 2.5:
                        logger.error("Heartbeat missed - connection may be dead")
                        await self.disconnect()
                        if self.config.auto_reconnect:
                            self._reconnect_task = asyncio.create_task(self._reconnect())
                        return
                    
                    ping_message = {
                        "id": self._generate_id(),
                        "type": "ping",
                        "payload": {},
                        "timestamp": int(datetime.now().timestamp() * 1000)
                    }
                    await self._send_message(ping_message)
                    
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                break
    
    async def _reconnect(self) -> None:
        """Attempt to reconnect with exponential backoff"""
        max_retries = self.config.reconnect_attempts or 5
        
        while self.reconnect_attempt < max_retries:
            try:
                # Calculate delay with exponential backoff and jitter
                base_delay = self.BACKOFF_BASE_MS * (self.BACKOFF_FACTOR ** self.reconnect_attempt)
                delay = min(base_delay, self.BACKOFF_MAX_MS) / 1000  # Convert to seconds
                
                # Add jitter
                jitter = 1 + (2 * self.BACKOFF_JITTER * (0.5 - asyncio.get_event_loop().time() % 1))
                delay *= jitter
                
                logger.info(f"Reconnection attempt {self.reconnect_attempt + 1}/{max_retries} in {delay:.2f}s")
                await asyncio.sleep(delay)
                
                self.reconnect_attempt += 1
                await self.connect()
                
                # Re-subscribe to channels
                if self.subscriptions:
                    await self.subscribe(list(self.subscriptions))
                
                logger.info("Reconnected successfully")
                return
                
            except Exception as e:
                logger.error(f"Reconnection attempt {self.reconnect_attempt} failed: {e}")
        
        logger.error("Failed to reconnect after maximum retries")
        # Could emit a connection_failed event here
    
    def _generate_id(self) -> str:
        """Generate unique message ID"""
        import uuid
        return str(uuid.uuid4())
    
    @property
    def is_connected(self) -> bool:
        """Check if client is connected"""
        return self.connection_state == ConnectionState.CONNECTED
    
    @property
    def organization_id(self) -> str:
        """Get organization ID"""
        return self.org_id
    
    @property
    def active_subscriptions(self) -> List[str]:
        """Get list of active subscriptions"""
        return list(self.subscriptions)


# Convenience functions for multi-tenant usage
async def create_org_client(org_id: str, token: str, gateway_url: str, **kwargs) -> AxonPulsClient:
    """Create client for specific organization"""
    config = AxonPulsClientConfig(
        url=gateway_url,
        token=token,
        client_type=kwargs.get("client_type", "python-org-client"),
        auto_reconnect=kwargs.get("auto_reconnect", True),
        heartbeat_interval=kwargs.get("heartbeat_interval", 30),
        reconnect_attempts=kwargs.get("reconnect_attempts", 5),
        debug=kwargs.get("debug", False),
    )
    
    client = AxonPulsClient(config)
    
    # Validate token contains correct org_id
    if client.org_id != org_id:
        raise AxonPulsValidationError(f"Token org_id ({client.org_id}) doesn't match requested org ({org_id})")
    
    await client.connect()
    return client
