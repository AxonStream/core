"""
AxonPuls Python Client - Multi-tenant real-time platform client
"""

from .client import AxonPulsClient, create_org_client
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

__version__ = "1.0.0"
__author__ = "AxonPuls Team"
__email__ = "support@AxonPuls.dev"

__all__ = [
    "AxonPulsClient",
    "create_org_client",
    "AxonPulsEvent",
    "AxonPulsClientConfig",
    "SubscribeOptions",
    "PublishOptions",
    "ConnectionState",
    "EventHandler",
    "AxonPulsError",
    "AxonPulsConnectionError",
    "AxonPulsAuthenticationError",
    "AxonPulsValidationError",
    "AxonPulsTenantIsolationError",
]
