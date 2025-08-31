import React, { useState, useEffect } from 'react';
import { X, Zap, ArrowRight, Clock, AlertTriangle } from 'lucide-react';

export interface UpgradePromptProps {
  title: string;
  message: string;
  ctaText: string;
  ctaUrl: string;
  features?: string[];
  pricing?: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  urgency?: 'low' | 'medium' | 'high';
  dismissible?: boolean;
  onDismiss?: () => void;
  onUpgrade?: () => void;
  className?: string;
}

export interface UsageMeterProps {
  current: number;
  limit: number;
  label: string;
  unit?: string;
  showUpgradePrompt?: boolean;
  onUpgrade?: () => void;
  className?: string;
}

export interface FeaturePreviewProps {
  feature: string;
  description: string;
  available: boolean;
  upgradeRequired?: boolean;
  onUpgrade?: () => void;
  className?: string;
}

/**
 * Upgrade prompt component with contextual messaging
 */
export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  title,
  message,
  ctaText,
  ctaUrl,
  features = [],
  pricing,
  urgency = 'low',
  dismissible = true,
  onDismiss,
  onUpgrade,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const urgencyStyles = {
    low: 'border-blue-200 bg-blue-50',
    medium: 'border-yellow-200 bg-yellow-50',
    high: 'border-red-200 bg-red-50',
  };

  const urgencyIcons = {
    low: <Zap className="w-5 h-5 text-blue-500" />,
    medium: <Clock className="w-5 h-5 text-yellow-500" />,
    high: <AlertTriangle className="w-5 h-5 text-red-500" />,
  };

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.open(ctaUrl, '_blank');
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`relative border rounded-lg p-6 ${urgencyStyles[urgency]} ${className}`}>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-start space-x-4">
        {urgencyIcons[urgency]}
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {title}
          </h3>
          
          <p className="text-gray-700 mb-4">
            {message}
          </p>

          {features.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900 mb-2">
                What you'll get:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pricing && (
            <div className="mb-4 p-3 bg-white rounded border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Starting at</span>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {pricing.currency === 'USD' ? '$' : ''}{pricing.monthly}/mo
                  </div>
                  <div className="text-xs text-gray-500">
                    or {pricing.currency === 'USD' ? '$' : ''}{pricing.yearly}/year
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleUpgrade}
            className={`
              inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
              ${urgency === 'high' 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : urgency === 'medium'
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
              transition-colors duration-200
            `}
          >
            {ctaText}
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Usage meter component with upgrade prompts
 */
export const UsageMeter: React.FC<UsageMeterProps> = ({
  current,
  limit,
  label,
  unit = '',
  showUpgradePrompt = false,
  onUpgrade,
  className = '',
}) => {
  const percentage = Math.min((current / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  const getBarColor = () => {
    if (isAtLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getTextColor = () => {
    if (isAtLimit) return 'text-red-700';
    if (isNearLimit) return 'text-yellow-700';
    return 'text-gray-700';
  };

  return (
    <div className={`p-4 border rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        <span className={`text-sm ${getTextColor()}`}>
          {current.toLocaleString()}/{limit.toLocaleString()} {unit}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {(isNearLimit || showUpgradePrompt) && (
        <div className="flex items-center justify-between">
          <span className={`text-xs ${getTextColor()}`}>
            {isAtLimit 
              ? 'Limit reached' 
              : isNearLimit 
              ? 'Approaching limit' 
              : 'Usage tracking'
            }
          </span>
          
          {onUpgrade && (
            <button
              onClick={onUpgrade}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Upgrade for more
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Feature preview component for locked features
 */
export const FeaturePreview: React.FC<FeaturePreviewProps> = ({
  feature,
  description,
  available,
  upgradeRequired = false,
  onUpgrade,
  className = '',
}) => {
  return (
    <div className={`relative p-4 border rounded-lg ${className}`}>
      {!available && (
        <div className="absolute inset-0 bg-gray-50 bg-opacity-75 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Zap className="w-4 h-4 text-yellow-600" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">
              {upgradeRequired ? 'Premium Feature' : 'Coming Soon'}
            </p>
            {upgradeRequired && onUpgrade && (
              <button
                onClick={onUpgrade}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Upgrade to unlock
              </button>
            )}
          </div>
        </div>
      )}

      <h4 className="text-lg font-semibold text-gray-900 mb-2">
        {feature}
      </h4>
      
      <p className="text-gray-600 text-sm">
        {description}
      </p>
    </div>
  );
};

/**
 * Hook for handling upgrade prompts and token expiration
 */
export const useUpgradeFlow = () => {
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<any>(null);

  useEffect(() => {
    // Listen for upgrade prompt events from API responses
    const handleUpgradePrompt = (event: CustomEvent) => {
      setUpgradeContext(event.detail);
      setShowUpgradePrompt(true);
    };

    window.addEventListener('axonstream:upgrade-prompt', handleUpgradePrompt as EventListener);

    // Check for expired tokens
    const checkTokenExpiration = () => {
      const token = localStorage.getItem('axonstream_token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiresAt = new Date(payload.expiresAt);
          const now = new Date();
          const timeRemaining = expiresAt.getTime() - now.getTime();

          // Show upgrade prompt if token expires in less than 30 minutes
          if (timeRemaining < 30 * 60 * 1000 && timeRemaining > 0) {
            setUpgradeContext({
              trigger: 'time_based',
              timeRemaining,
            });
            setShowUpgradePrompt(true);
          }
        } catch (error) {
          console.warn('Failed to parse token:', error);
        }
      }
    };

    // Check token expiration every 5 minutes
    const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000);
    checkTokenExpiration(); // Check immediately

    return () => {
      window.removeEventListener('axonstream:upgrade-prompt', handleUpgradePrompt as EventListener);
      clearInterval(interval);
    };
  }, []);

  const dismissUpgradePrompt = () => {
    setShowUpgradePrompt(false);
    setUpgradeContext(null);
  };

  const handleUpgrade = () => {
    // Track upgrade click
    if (upgradeContext) {
      fetch('/api/v1/upgrade/track-interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clicked',
          context: upgradeContext,
        }),
      }).catch(console.error);
    }

    // Redirect to upgrade page
    window.location.href = '/upgrade';
  };

  return {
    showUpgradePrompt,
    upgradeContext,
    dismissUpgradePrompt,
    handleUpgrade,
  };
};
