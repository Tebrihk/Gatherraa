# Load Testing

This directory contains load testing scripts using k6 (https://k6.io/).

## Setup

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Or use Docker
docker run -i grafana/k6
```

## Tests

- **chaos-test.js** - Spike testing to verify system recovery
- **notification-flow.js** - WebSocket connection testing with ramping load
- **payment-flow.js** - Payment API testing with error tracking

## Running Tests

```bash
k6 run chaos-test.js
k6 run notification-flow.js
k6 run payment-flow.js
```

## Docker

Run tests in Docker:
```bash
docker run -v $(pwd):/scripts grafana/k6 run /scripts/chaos-test.js
```

## Configuration

Edit the `options` section in each script to modify:
- Duration (stages)
- Target load (concurrent users/requests)
- Thresholds (performance requirements)
