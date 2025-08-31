# Enterprise Demo Deployment Guide

## 🚀 Quick Deployment

### Prerequisites
- Node.js 20+
- AxonStream Platform running (localhost:3000)
- Valid JWT tokens

### 1. Deploy All Demos
```bash
# Clone and setup
git clone <your-repo>
cd enterprise-demos

# Install all dependencies
for demo in */; do
    cd "$demo"
    npm install
    cd ..
done
```

### 2. Configure Environment
```bash
# Set environment variables for all demos
export REACT_APP_AXONSTREAM_URL="ws://localhost:3000"
export REACT_APP_JWT_TOKEN="your-jwt-token"
export AXONSTREAM_URL="ws://localhost:3000" 
export AXONSTREAM_TOKEN="your-jwt-token"
```

### 3. Run Demos
```bash
# Procurement Demo
cd procurement && npm run demo

# Trading Demo  
cd financial-trading && npm run demo

# Manufacturing Demo
cd manufacturing && npm run demo

# Healthcare Demo
cd healthcare && npm run demo
```

## 🌐 Production Deployment

### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: axonstream-demo
spec:
  replicas: 3
  selector:
    matchLabels:
      app: axonstream-demo
  template:
    metadata:
      labels:
        app: axonstream-demo
    spec:
      containers:
      - name: demo
        image: axonstream-demo:latest
        ports:
        - containerPort: 3000
        env:
        - name: AXONSTREAM_URL
          value: "ws://axonstream-api:3000"
```

## 📊 Demo Scenarios

### Procurement Demo
**URL**: http://localhost:3001  
**Use Case**: Real-time vendor selection and approval workflows  
**Users**: Procurement team, managers, finance  

### Trading Demo  
**URL**: http://localhost:3002  
**Use Case**: High-frequency trading with risk management  
**Users**: Traders, risk managers, compliance  

### Manufacturing Demo
**URL**: http://localhost:3003  
**Use Case**: IoT monitoring and production optimization  
**Users**: Plant managers, engineers, operators  

### Healthcare Demo
**URL**: http://localhost:3004  
**Use Case**: Patient monitoring and emergency alerts  
**Users**: Doctors, nurses, administrators  

## 🎯 Demo Scripts

### Procurement Scenario
1. **Vendor Performance Update**: Watch real-time vendor scores change
2. **Approval Workflow**: Submit procurement request → Manager approval
3. **Smart Recommendations**: Request vendor recommendations for category
4. **Risk Alerts**: Monitor supply chain disruptions

### Trading Scenario  
1. **Market Data**: Live price feeds for 5 major stocks
2. **Trade Execution**: Place buy/sell orders → Instant execution
3. **Risk Management**: Monitor position limits and P&L
4. **Portfolio Analytics**: Real-time portfolio performance

### Manufacturing Scenario
1. **IoT Monitoring**: Sensor data from production line
2. **Predictive Maintenance**: Equipment failure predictions  
3. **Quality Control**: Real-time quality metrics
4. **Production Optimization**: Throughput and efficiency metrics

### Healthcare Scenario
1. **Patient Monitoring**: Vital signs and alerts
2. **Emergency Response**: Critical condition notifications
3. **Resource Management**: Bed availability and staffing
4. **Clinical Workflows**: Treatment protocols and reminders

## 📈 Performance Metrics

Each demo tracks:
- **Connection Latency**: < 100ms
- **Message Throughput**: 1000+ msg/sec
- **Update Frequency**: Real-time (1-5 second intervals)
- **Concurrent Users**: 100+ simultaneous users

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Multi-tenant Isolation**: Organization data separation  
- **Role-based Access**: User permission enforcement
- **Audit Logging**: Complete activity tracking

---

**These demos provide concrete proof of AxonStream's enterprise capabilities across multiple industries.**
