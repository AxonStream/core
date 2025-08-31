
const { AxonPulsClient } = require('@axonstream/core');

class TradingSimulator {
    constructor() {
        this.client = new AxonPulsClient({
            url: process.env.AXONSTREAM_URL || 'ws://localhost:3000',
            token: process.env.AXONSTREAM_TOKEN || 'demo-token'
        });
        
        this.stocks = {
            'AAPL': { symbol: 'AAPL', price: 150.00, change: 0 },
            'GOOGL': { symbol: 'GOOGL', price: 2800.00, change: 0 },
            'MSFT': { symbol: 'MSFT', price: 330.00, change: 0 },
            'TSLA': { symbol: 'TSLA', price: 220.00, change: 0 },
            'NVDA': { symbol: 'NVDA', price: 450.00, change: 0 }
        };
        
        this.positions = [];
        this.riskThreshold = 50000; // $50K risk threshold
    }

    async start() {
        await this.client.connect();
        console.log('💰 Trading Simulator Started');
        
        this.client.subscribe('trade-order');
        
        this.client.on('message', (data) => {
            if (data.channel === 'trade-order') {
                this.executeTrade(data.payload);
            }
        });
        
        this.simulateMarketData();
        this.simulateRiskAlerts();
        this.sendInitialPositions();
    }
    
    simulateMarketData() {
        setInterval(() => {
            Object.values(this.stocks).forEach(stock => {
                // Simulate price movements
                const changePercent = (Math.random() - 0.5) * 0.02; // ±1% max change
                const priceChange = stock.price * changePercent;
                
                stock.price += priceChange;
                stock.change = priceChange;
                
                this.client.send('market-data', {
                    symbol: stock.symbol,
                    price: parseFloat(stock.price.toFixed(2)),
                    change: parseFloat(priceChange.toFixed(2)),
                    volume: Math.floor(Math.random() * 1000000),
                    timestamp: Date.now()
                });
            });
        }, 1000); // Update every second
    }
    
    simulateRiskAlerts() {
        const alertTypes = [
            { type: 'position-limit', severity: 'high', message: 'Position limit exceeded for TSLA' },
            { type: 'volatility', severity: 'medium', message: 'High volatility detected in tech sector' },
            { type: 'margin-call', severity: 'high', message: 'Margin call warning - insufficient funds' },
            { type: 'correlation', severity: 'medium', message: 'High correlation risk in portfolio' },
            { type: 'concentration', severity: 'low', message: 'Portfolio concentration above threshold' }
        ];
        
        setInterval(() => {
            if (Math.random() > 0.7) { // 30% chance of alert
                const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
                
                this.client.send('risk-alerts', {
                    type: alert.type,
                    severity: alert.severity,
                    message: alert.message,
                    timestamp: Date.now()
                });
                
                console.log(`🚨 Risk alert: ${alert.message}`);
            }
        }, 10000); // Check every 10 seconds
    }
    
    sendInitialPositions() {
        const initialPositions = [
            { symbol: 'AAPL', side: 'buy', quantity: 500, avgPrice: 148.50 },
            { symbol: 'GOOGL', side: 'buy', quantity: 100, avgPrice: 2750.00 },
            { symbol: 'TSLA', side: 'sell', quantity: 200, avgPrice: 225.00 }
        ];
        
        initialPositions.forEach(position => {
            this.positions.push(position);
            this.client.send('position-updates', position);
        });
    }
    
    executeTrade(order) {
        const executionPrice = this.stocks[order.symbol].price * (1 + (Math.random() - 0.5) * 0.001); // Small slippage
        
        // Update positions
        const existingPosition = this.positions.find(p => p.symbol === order.symbol);
        if (existingPosition) {
            if (existingPosition.side === order.side) {
                // Add to position
                const totalQuantity = existingPosition.quantity + order.quantity;
                existingPosition.avgPrice = (existingPosition.avgPrice * existingPosition.quantity + executionPrice * order.quantity) / totalQuantity;
                existingPosition.quantity = totalQuantity;
            } else {
                // Reduce or reverse position
                existingPosition.quantity -= order.quantity;
                if (existingPosition.quantity <= 0) {
                    existingPosition.side = order.side;
                    existingPosition.quantity = Math.abs(existingPosition.quantity);
                    existingPosition.avgPrice = executionPrice;
                }
            }
        } else {
            this.positions.push({
                symbol: order.symbol,
                side: order.side,
                quantity: order.quantity,
                avgPrice: executionPrice
            });
        }
        
        // Send trade execution
        this.client.send('trade-executions', {
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantity,
            price: parseFloat(executionPrice.toFixed(2)),
            orderId: order.orderId || `order_${Date.now()}`,
            status: 'filled',
            timestamp: Date.now()
        });
        
        // Send updated position
        const updatedPosition = this.positions.find(p => p.symbol === order.symbol);
        if (updatedPosition) {
            this.client.send('position-updates', updatedPosition);
        }
        
        console.log(`📈 Executed trade: ${order.side.toUpperCase()} ${order.quantity} ${order.symbol} @ $${executionPrice.toFixed(2)}`);
        
        // Check for risk alerts
        this.checkRiskLimits();
    }
    
    checkRiskLimits() {
        const totalRisk = this.positions.reduce((total, pos) => {
            const currentPrice = this.stocks[pos.symbol].price;
            const positionValue = Math.abs(currentPrice * pos.quantity);
            return total + positionValue;
        }, 0);
        
        if (totalRisk > this.riskThreshold) {
            this.client.send('risk-alerts', {
                type: 'total-risk',
                severity: 'high',
                message: `Total position risk ($${totalRisk.toLocaleString()}) exceeds threshold ($${this.riskThreshold.toLocaleString()})`,
                timestamp: Date.now()
            });
        }
    }
}

const simulator = new TradingSimulator();
simulator.start().catch(console.error);
