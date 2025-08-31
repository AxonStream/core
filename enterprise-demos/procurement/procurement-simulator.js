
const { AxonPulsClient } = require('@axonstream/core');

class ProcurementSimulator {
    constructor() {
        this.client = new AxonPulsClient({
            url: process.env.AXONSTREAM_URL || 'ws://localhost:3000',
            token: process.env.AXONSTREAM_TOKEN || 'demo-token'
        });
        
        this.vendors = [
            { id: 'V001', name: 'Alpha Supplies', score: 85, onTimeDelivery: 95, qualityScore: 89, trend: 'up' },
            { id: 'V002', name: 'Beta Corp', score: 78, onTimeDelivery: 87, qualityScore: 82, trend: 'stable' },
            { id: 'V003', name: 'Gamma Industries', score: 92, onTimeDelivery: 98, qualityScore: 94, trend: 'up' },
            { id: 'V004', name: 'Delta Logistics', score: 71, onTimeDelivery: 76, qualityScore: 78, trend: 'down' }
        ];
    }

    async start() {
        await this.client.connect();
        console.log('🏢 Procurement Simulator Started');
        
        // Subscribe to vendor recommendation requests
        this.client.subscribe('vendor-recommendation-request');
        this.client.subscribe('approval-response');
        
        this.client.on('message', (data) => {
            if (data.channel === 'vendor-recommendation-request') {
                this.handleVendorRecommendationRequest(data.payload);
            } else if (data.channel === 'approval-response') {
                this.handleApprovalResponse(data.payload);
            }
        });
        
        // Start simulation loops
        this.simulateVendorUpdates();
        this.simulateAlerts();
        this.simulateApprovalRequests();
    }
    
    simulateVendorUpdates() {
        setInterval(() => {
            const vendor = this.vendors[Math.floor(Math.random() * this.vendors.length)];
            
            // Simulate score changes
            const scoreChange = (Math.random() - 0.5) * 10;
            vendor.score = Math.max(0, Math.min(100, vendor.score + scoreChange));
            vendor.onTimeDelivery = Math.max(0, Math.min(100, vendor.onTimeDelivery + (Math.random() - 0.5) * 5));
            vendor.qualityScore = Math.max(0, Math.min(100, vendor.qualityScore + (Math.random() - 0.5) * 5));
            
            // Update trend
            vendor.trend = scoreChange > 2 ? 'up' : scoreChange < -2 ? 'down' : 'stable';
            
            this.client.send('vendor-performance', {
                vendorId: vendor.id,
                name: vendor.name,
                score: Math.round(vendor.score),
                onTimeDelivery: Math.round(vendor.onTimeDelivery),
                qualityScore: Math.round(vendor.qualityScore),
                trend: vendor.trend,
                timestamp: Date.now()
            });
            
            console.log(`📊 Updated vendor ${vendor.name}: score ${Math.round(vendor.score)}`);
        }, 5000 + Math.random() * 10000); // Every 5-15 seconds
    }
    
    simulateAlerts() {
        const alertTypes = [
            { type: 'price-alert', message: 'Commodity prices increased by 5%' },
            { type: 'delivery-delay', message: 'Vendor Alpha Supplies reports 2-day delay' },
            { type: 'quality-issue', message: 'Quality concern reported for Gamma Industries' },
            { type: 'new-vendor', message: 'New vendor application received' },
            { type: 'contract-renewal', message: 'Contract with Beta Corp expires in 30 days' }
        ];
        
        setInterval(() => {
            const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
            
            this.client.send('procurement-alerts', {
                type: alert.type,
                message: alert.message,
                severity: Math.random() > 0.7 ? 'high' : 'medium',
                timestamp: Date.now()
            });
            
            console.log(`🔔 Sent alert: ${alert.message}`);
        }, 15000 + Math.random() * 30000); // Every 15-45 seconds
    }
    
    simulateApprovalRequests() {
        const requests = [
            { vendor: 'Alpha Supplies', amount: 25000, category: 'Electronics' },
            { vendor: 'Beta Corp', amount: 50000, category: 'Raw Materials' },
            { vendor: 'Gamma Industries', amount: 15000, category: 'Packaging' },
            { vendor: 'Delta Logistics', amount: 35000, category: 'Logistics' }
        ];
        
        setInterval(() => {
            const request = requests[Math.floor(Math.random() * requests.length)];
            
            this.client.send('approval-requests', {
                id: `req_${Date.now()}`,
                vendor: request.vendor,
                amount: request.amount,
                category: request.category,
                urgency: Math.random() > 0.8 ? 'high' : 'normal',
                requestedBy: 'procurement-team',
                timestamp: Date.now()
            });
            
            console.log(`📋 Sent approval request: $${request.amount} from ${request.vendor}`);
        }, 45000 + Math.random() * 60000); // Every 45-105 seconds
    }
    
    handleVendorRecommendationRequest(request) {
        const categoryVendors = this.vendors.filter(v => 
            v.score > 75 // Only recommend high-scoring vendors
        ).sort((a, b) => b.score - a.score);
        
        const recommendations = categoryVendors.slice(0, 3).map(vendor => ({
            vendorId: vendor.id,
            name: vendor.name,
            score: vendor.score,
            recommendation: vendor.score > 90 ? 'Highly Recommended' : 
                          vendor.score > 80 ? 'Recommended' : 'Consider with caution',
            estimatedDelivery: Math.floor(Math.random() * 14) + 3 + ' days'
        }));
        
        this.client.send('vendor-recommendations', {
            requestId: request.requestId || `rec_${Date.now()}`,
            category: request.category,
            recommendations: recommendations,
            generatedAt: Date.now()
        });
        
        console.log(`🤖 Sent vendor recommendations for ${request.category}`);
    }
    
    handleApprovalResponse(response) {
        console.log(`✅ Approval ${response.approved ? 'granted' : 'denied'} for request ${response.requestId}`);
        
        // Send confirmation
        this.client.send('procurement-alerts', {
            type: 'approval-update',
            message: `Purchase request ${response.requestId} was ${response.approved ? 'approved' : 'denied'}`,
            severity: 'info',
            timestamp: Date.now()
        });
    }
}

const simulator = new ProcurementSimulator();
simulator.start().catch(console.error);
