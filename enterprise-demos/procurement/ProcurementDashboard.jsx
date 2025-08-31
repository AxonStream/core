
import React, { useState, useEffect } from 'react';
import { AxonPulsClient } from '@axonstream/core';

const ProcurementDashboard = () => {
    const [client, setClient] = useState(null);
    const [vendors, setVendors] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const axonClient = new AxonPulsClient({
            url: process.env.REACT_APP_AXONSTREAM_URL,
            token: process.env.REACT_APP_JWT_TOKEN
        });

        axonClient.connect().then(() => {
            setClient(axonClient);
            setIsConnected(true);

            // Subscribe to real-time vendor updates
            axonClient.subscribe('vendor-performance');
            axonClient.subscribe('procurement-alerts');
            axonClient.subscribe('approval-requests');

            // Handle vendor performance updates
            axonClient.on('message', (data) => {
                switch (data.channel) {
                    case 'vendor-performance':
                        handleVendorUpdate(data.payload);
                        break;
                    case 'procurement-alerts':
                        addNotification(data.payload);
                        break;
                    case 'approval-requests':
                        handleApprovalRequest(data.payload);
                        break;
                }
            });
        });

        return () => {
            if (axonClient) {
                axonClient.disconnect();
            }
        };
    }, []);

    const handleVendorUpdate = (vendorData) => {
        setVendors(prev => {
            const updated = [...prev];
            const index = updated.findIndex(v => v.id === vendorData.vendorId);
            if (index >= 0) {
                updated[index] = { ...updated[index], ...vendorData };
            } else {
                updated.push(vendorData);
            }
            return updated;
        });
    };

    const addNotification = (notification) => {
        setNotifications(prev => [{
            id: Date.now(),
            timestamp: new Date().toISOString(),
            ...notification
        }, ...prev.slice(0, 9)]);
    };

    const handleApprovalRequest = (request) => {
        // Show approval dialog
        if (window.confirm(`Approve procurement request for ${request.amount} from ${request.vendor}?`)) {
            client.send('approval-response', {
                requestId: request.id,
                approved: true,
                approvedBy: 'current-user-id'
            });
        }
    };

    const requestVendorRecommendation = (category, requirements) => {
        if (client && isConnected) {
            client.send('vendor-recommendation-request', {
                category,
                requirements,
                requestedBy: 'current-user-id',
                timestamp: Date.now()
            });
        }
    };

    return (
        <div className="procurement-dashboard">
            <header className="dashboard-header">
                <h1>🏢 Enterprise Procurement Dashboard</h1>
                <div className="connection-status">
                    Status: <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
                        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                    </span>
                </div>
            </header>

            <div className="dashboard-grid">
                <section className="vendor-performance">
                    <h2>📊 Real-Time Vendor Performance</h2>
                    <div className="vendor-grid">
                        {vendors.map(vendor => (
                            <div key={vendor.id} className="vendor-card">
                                <h3>{vendor.name}</h3>
                                <div className="metrics">
                                    <div className="metric">
                                        <span className="label">Score:</span>
                                        <span className="value">{vendor.score}/100</span>
                                    </div>
                                    <div className="metric">
                                        <span className="label">On-Time:</span>
                                        <span className="value">{vendor.onTimeDelivery}%</span>
                                    </div>
                                    <div className="metric">
                                        <span className="label">Quality:</span>
                                        <span className="value">{vendor.qualityScore}%</span>
                                    </div>
                                </div>
                                <div className={`trend ${vendor.trend}`}>
                                    {vendor.trend === 'up' ? '📈' : vendor.trend === 'down' ? '📉' : '➡️'} 
                                    {vendor.trend}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="notifications">
                    <h2>🔔 Live Notifications</h2>
                    <div className="notification-list">
                        {notifications.map(notification => (
                            <div key={notification.id} className="notification">
                                <div className="notification-header">
                                    <span className="type">{notification.type}</span>
                                    <span className="timestamp">
                                        {new Date(notification.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="notification-body">
                                    {notification.message}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="smart-recommendations">
                    <h2>🤖 Smart Vendor Recommendations</h2>
                    <div className="recommendation-form">
                        <select onChange={(e) => requestVendorRecommendation(e.target.value, {})}>
                            <option value="">Select Category</option>
                            <option value="electronics">Electronics</option>
                            <option value="packaging">Packaging</option>
                            <option value="raw-materials">Raw Materials</option>
                            <option value="logistics">Logistics</option>
                        </select>
                        <button onClick={() => requestVendorRecommendation('electronics', { urgency: 'high' })}>
                            Get Recommendation
                        </button>
                    </div>
                </section>
            </div>

            <style jsx>{`
                .procurement-dashboard {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 10px;
                }
                
                .connection-status .status.connected {
                    color: #00ff88;
                }
                
                .connection-status .status.disconnected {
                    color: #ff4444;
                }
                
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    grid-template-rows: auto auto;
                    gap: 20px;
                }
                
                .vendor-performance {
                    grid-column: 1;
                    grid-row: 1 / 3;
                }
                
                .vendor-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 15px;
                }
                
                .vendor-card {
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 15px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transition: transform 0.2s;
                }
                
                .vendor-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                }
                
                .metrics {
                    display: flex;
                    justify-content: space-between;
                    margin: 10px 0;
                }
                
                .metric {
                    text-align: center;
                }
                
                .metric .label {
                    display: block;
                    font-size: 12px;
                    color: #666;
                }
                
                .metric .value {
                    display: block;
                    font-size: 18px;
                    font-weight: bold;
                    color: #333;
                }
                
                .notifications {
                    grid-column: 2;
                    grid-row: 1;
                }
                
                .notification-list {
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .notification {
                    background: #f8f9fa;
                    border-left: 4px solid #007bff;
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 4px;
                }
                
                .notification-header {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 5px;
                }
                
                .smart-recommendations {
                    grid-column: 2;
                    grid-row: 2;
                }
                
                .recommendation-form select,
                .recommendation-form button {
                    width: 100%;
                    padding: 10px;
                    margin: 5px 0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                
                .recommendation-form button {
                    background: #007bff;
                    color: white;
                    cursor: pointer;
                }
                
                .recommendation-form button:hover {
                    background: #0056b3;
                }
            `}</style>
        </div>
    );
};

export default ProcurementDashboard;
