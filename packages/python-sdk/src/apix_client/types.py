"""
Type definitions for AxonPuls Python client
"""
from typing import Any, Callable, Dict, List, Optional, Union
from dataclasses import dataclass
from enum import Enum


class ConnectionState(Enum):
    """Connection state enumeration"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    RECONNECTING = "reconnecting"


@dataclass
class AxonPulsClientConfig:
    """Configuration for AxonPuls client"""
    url: str
    token: str
    client_type: Optional[str] = None
    auto_reconnect: bool = True
    heartbeat_interval: Optional[int] = None
    reconnect_attempts: Optional[int] = None
    debug: bool = False


@dataclass
class AxonPulsEvent:
    """AxonPuls event structure"""
    id: str
    type: str
    payload: Any
    timestamp: int
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class SubscribeOptions:
    """Options for channel subscription"""
    replay_from: Optional[str] = None
    replay_count: Optional[int] = None
    filter: Optional[str] = None


@dataclass
class PublishOptions:
    """Options for event publishing"""
    delivery_guarantee: Optional[str] = None  # 'at_least_once' | 'at_most_once'
    partition_key: Optional[str] = None


# Type alias for event handlers
EventHandler = Callable[[Dict[str, Any]], Union[None, Any]]
