"""
Error classes for AxonPuls Python client
"""
from typing import Any, Dict, Optional


class AxonPulsError(Exception):
    """Base exception for AxonPuls client errors"""
    
    def __init__(
        self, 
        message: str, 
        code: Optional[str] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code or "AxonPuls_UNKNOWN_ERROR"
        self.details = details or {}
    
    def __str__(self) -> str:
        if self.details:
            return f"{self.message} (Code: {self.code}, Details: {self.details})"
        return f"{self.message} (Code: {self.code})"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary"""
        return {
            "message": self.message,
            "code": self.code,
            "details": self.details,
            "type": self.__class__.__name__,
        }


class AxonPulsConnectionError(AxonPulsError):
    """Raised when connection-related errors occur"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AxonPuls_CONNECTION_ERROR", details)


class AxonPulsAuthenticationError(AxonPulsError):
    """Raised when authentication fails"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AxonPuls_AUTH_ERROR", details)


class AxonPulsValidationError(AxonPulsError):
    """Raised when validation fails"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AxonPuls_VALIDATION_ERROR", details)


class AxonPulsTenantIsolationError(AxonPulsError):
    """Raised when tenant isolation is violated"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AxonPuls_TENANT_ISOLATION_ERROR", details)


class AxonPulsRateLimitError(AxonPulsError):
    """Raised when rate limits are exceeded"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AxonPuls_RATE_LIMIT_ERROR", details)


class AxonPulsCircuitBreakerError(AxonPulsError):
    """Raised when circuit breaker is open"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AxonPuls_CIRCUIT_BREAKER_ERROR", details)
