
import React, { useState, useEffect } from 'react';
import { AxonPulsClient } from '@axonstream/core';

const TradingDashboard = () => {
    const [client, setClient] = useState(null);
    const [positions, setPositions] = useState([]);
    const [marketData, setMarketData] = useState({});
    const [riskAlerts, setRiskAlerts] = useState([]);
    const [trades, setTrades] = useState([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const axonClient = new AxonPulsClient({
            url: process.env.REACT_APP_AXONSTREAM_URL,
            token: process.env.REACT_APP_JWT_TOKEN
        });

        axonClient.connect().then(() => {
            setClient(axonClient);
            setIsConnected(true);

            // Subscribe to trading channels
            axonClient.subscribe('market-data');
            axonClient.subscribe('risk-alerts');
            axonClient.subscribe('trade-executions');
            axonClient.subscribe('position-updates');

            axonClient.on('message', (data) => {
                switch (data.channel) {
                    case 'market-data':
                        updateMarketData(data.payload);
                        break;
                    case 'risk-alerts':
                        addRiskAlert(data.payload);
                        break;
                    case 'trade-executions':
                        addTrade(data.payload);
                        break;
                    case 'position-updates':
                        updatePositions(data.payload);
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

    const updateMarketData = (data) => {
        setMarketData(prev => ({
            ...prev,
            [data.symbol]: data
        }));
    };

    const addRiskAlert = (alert) => {
        setRiskAlerts(prev => [{
            id: Date.now(),
            timestamp: new Date().toISOString(),
            ...alert
        }, ...prev.slice(0, 9)]);
    };

    const addTrade = (trade) => {
        setTrades(prev => [{
            id: Date.now(),
            timestamp: new Date().toISOString(),
            ...trade
        }, ...prev.slice(0, 19)]);
    };

    const updatePositions = (positionData) => {
        setPositions(prev => {
            const updated = [...prev];
            const index = updated.findIndex(p => p.symbol === positionData.symbol);
            if (index >= 0) {
                updated[index] = { ...updated[index], ...positionData };
            } else {
                updated.push(positionData);
            }
            return updated;
        });
    };

    const executeTrade = (symbol, side, quantity, price) => {
        if (client && isConnected) {
            client.send('trade-order', {
                symbol,
                side,
                quantity,
                price,
                type: 'limit',
                traderId: 'current-trader-id',
                timestamp: Date.now()
            });
        }
    };

    const calculatePnL = (position) => {
        const currentPrice = marketData[position.symbol]?.price || position.avgPrice;
        const pnl = (currentPrice - position.avgPrice) * position.quantity;
        return position.side === 'short' ? -pnl : pnl;
    };

    const getTotalPnL = () => {
        return positions.reduce((total, pos) => total + calculatePnL(pos), 0);
    };

    return (
        <div className="trading-dashboard">
            <header className="dashboard-header">
                <h1>💰 Enterprise Trading Platform</h1>
                <div className="connection-status">
                    Status: <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
                        {isConnected ? '🟢 Live Market Data' : '🔴 Disconnected'}
                    </span>
                </div>
                <div className="total-pnl">
                    Total P&L: <span className={`pnl ${getTotalPnL() >= 0 ? 'positive' : 'negative'}`}>
                        {`$${getTotalPnL().toLocaleString()}`}
                    </span>
                </div>
            </header>

            <div className="trading-grid">
                <section className="market-data">
                    <h2>📊 Live Market Data</h2>
                    <div className="market-grid">
                        {Object.values(marketData).map(stock => (
                            <div key={stock.symbol} className="market-card">
                                <h3>{stock.symbol}</h3>
                                <div className="price">
                                    {`$${stock.price}`}
                                    <span className={`change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                                        {stock.change >= 0 ? '+' : ''}{`$${stock.change.toFixed(2)}`}
                                    </span>
                                </div>
                                <div className="trade-buttons">
                                    <button 
                                        className="buy-btn"
                                        onClick={() => executeTrade(stock.symbol, 'buy', 100, stock.price)}
                                    >
                                        BUY
                                    </button>
                                    <button 
                                        className="sell-btn"
                                        onClick={() => executeTrade(stock.symbol, 'sell', 100, stock.price)}
                                    >
                                        SELL
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="positions">
                    <h2>📈 Current Positions</h2>
                    <div className="positions-table">
                        <div className="table-header">
                            <span>Symbol</span>
                            <span>Side</span>
                            <span>Quantity</span>
                            <span>Avg Price</span>
                            <span>Current Price</span>
                            <span>P&L</span>
                        </div>
                        {positions.map(position => (
                            <div key={position.symbol} className="table-row">
                                <span>{position.symbol}</span>
                                <span className={`side ${position.side}`}>{position.side.toUpperCase()}</span>
                                <span>{position.quantity}</span>
                                <span>{`$${position.avgPrice}`}</span>
                                <span>{`$${marketData[position.symbol]?.price || position.avgPrice}`}</span>
                                <span className={`pnl ${calculatePnL(position) >= 0 ? 'positive' : 'negative'}`}>
                                    {`$${calculatePnL(position).toLocaleString()}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="risk-alerts">
                    <h2>🚨 Risk Alerts</h2>
                    <div className="alerts-list">
                        {riskAlerts.map(alert => (
                            <div key={alert.id} className={`alert ${alert.severity}`}>
                                <div className="alert-header">
                                    <span className="type">{alert.type}</span>
                                    <span className="time">
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="alert-message">{alert.message}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="trade-history">
                    <h2>📋 Recent Trades</h2>
                    <div className="trades-list">
                        {trades.map(trade => (
                            <div key={trade.id} className="trade-item">
                                <span className="symbol">{trade.symbol}</span>
                                <span className={`side ${trade.side}`}>{trade.side.toUpperCase()}</span>
                                <span className="quantity">{trade.quantity}</span>
                                <span className="price">{`$${trade.price}`}</span>
                                <span className="time">
                                    {new Date(trade.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <style jsx>{`
                .trading-dashboard {
                    font-family: 'Roboto Mono', monospace;
                    max-width: 1600px;
                    margin: 0 auto;
                    padding: 20px;
                    background: #1a1a1a;
                    color: #ffffff;
                    min-height: 100vh;
                }
                
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                    border-radius: 10px;
                }
                
                .total-pnl .pnl.positive { color: #00ff88; }
                .total-pnl .pnl.negative { color: #ff4444; }
                
                .trading-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    grid-template-rows: auto auto;
                    gap: 20px;
                }
                
                .market-data {
                    grid-column: 1;
                    grid-row: 1;
                }
                
                .market-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 15px;
                }
                
                .market-card {
                    background: #2c2c2c;
                    border: 1px solid #444;
                    border-radius: 8px;
                    padding: 15px;
                    text-align: center;
                }
                
                .price {
                    font-size: 24px;
                    font-weight: bold;
                    margin: 10px 0;
                }
                
                .change.positive { color: #00ff88; }
                .change.negative { color: #ff4444; }
                
                .trade-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 10px;
                }
                
                .buy-btn {
                    background: #00aa44;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    flex: 1;
                }
                
                .sell-btn {
                    background: #cc2244;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    flex: 1;
                }
                
                .positions {
                    grid-column: 2;
                    grid-row: 1;
                }
                
                .positions-table {
                    background: #2c2c2c;
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .table-header,
                .table-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
                    padding: 10px;
                    border-bottom: 1px solid #444;
                }
                
                .table-header {
                    background: #3c3c3c;
                    font-weight: bold;
                }
                
                .side.buy { color: #00ff88; }
                .side.sell { color: #ff4444; }
                
                .risk-alerts {
                    grid-column: 1;
                    grid-row: 2;
                }
                
                .alerts-list {
                    max-height: 300px;
                    overflow-y: auto;
                }
                
                .alert {
                    background: #2c2c2c;
                    border-left: 4px solid;
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 4px;
                }
                
                .alert.high { border-left-color: #ff4444; }
                .alert.medium { border-left-color: #ffaa00; }
                .alert.low { border-left-color: #00ff88; }
                
                .trade-history {
                    grid-column: 2;
                    grid-row: 2;
                }
                
                .trades-list {
                    background: #2c2c2c;
                    border-radius: 8px;
                    max-height: 300px;
                    overflow-y: auto;
                }
                
                .trade-item {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
                    padding: 8px 10px;
                    border-bottom: 1px solid #444;
                    font-size: 14px;
                }
            `}</style>
        </div>
    );
};

export default TradingDashboard;
