# 🎨 Factory Monitoring Dashboard - User Guide

## 🚀 Quick Start

### 1. Start the Server

```bash
npm start
```

You should see:
```
============================================================
🏭 Factory Event Backend Server
============================================================
📡 API Server: http://localhost:3000
🎨 Dashboard: http://localhost:3000/index.html
💚 Health Check: http://localhost:3000/health
============================================================
```

### 2. Open the Dashboard

Open your browser and navigate to:
```
http://localhost:3000/index.html
```

---

## 📊 Dashboard Features

### **Overview Tab** (Home)

The main dashboard showing real-time factory metrics:

#### **KPI Cards**
- **Total Events**: Live count of all processed events
- **Healthy Machines**: Number of machines operating within normal parameters
- **Total Defects**: Cumulative defect count across all machines
- **Avg Defect Rate**: Average defects per hour

#### **Machine Status**
Real-time status of all monitored machines with health indicators

#### **Top Defect Lines**
Production lines ranked by defect count with visual bars
- Filter by factory using the dropdown
- Shows defect percentage and event count

#### **Recent Events**
Live feed of the latest 10 events with:
- Event ID and Machine ID
- Defect count
- Timestamp
- Health status badge

---

### **Machines Tab**

Monitor individual machine performance:

- **Machine Cards**: Each card shows:
  - Machine ID
  - Health status (Healthy/Warning)
  - Total events processed
  - Total defects
  - Defect rate
  - Uptime percentage

- **Search**: Filter machines by ID
- **Add Machine**: (Future feature)

---

### **Events Tab**

Ingest new events into the system:

#### **Single Event Ingestion**

Fill out the form:
- **Event ID**: Unique identifier (e.g., E-001)
- **Machine ID**: Select from dropdown (M-001, M-002, M-003)
- **Duration (ms)**: Event duration (0 - 21,600,000 ms = 6 hours)
- **Defect Count**: Number of defects (-1 for unknown)
- **Line ID**: Optional production line identifier
- **Factory ID**: Optional factory identifier

Click **Submit Event** to ingest.

#### **Batch Generation**

Click **Generate Batch (100 events)** to automatically create and ingest 100 random events for testing.

**Result Box** shows:
- Accepted events
- Rejected events
- Updated events
- Processing time in milliseconds

---

### **Analytics Tab**

Query detailed statistics:

#### **Query Statistics Form**

1. Select **Machine ID**
2. Choose **Time Range**:
   - Last 1 hour
   - Last 6 hours
   - Last 24 hours
   - Last 7 days

3. Click **Query Stats**

**Results Display**:
- Total Events
- Total Defects
- Average Defect Rate
- Health Status (Healthy/Warning)

---

### **Alerts Tab**

View system alerts and warnings:
- Critical alerts (red)
- Warning alerts (orange)
- Alert descriptions and timestamps

---

## 🎮 Interactive Features

### **Simulate Events Button**

Located in the sidebar, this button:
- Generates 20 random events
- Distributes across multiple machines
- Includes realistic defect patterns
- Updates all dashboard metrics automatically

**Perfect for testing and demonstration!**

### **Auto-Refresh**

The dashboard automatically refreshes every 5 seconds when on the Overview tab.

### **Real-Time Updates**

All metrics update instantly when:
- New events are ingested
- Batch operations complete
- Simulations run

---

## 🎨 Design Features

### **Modern Dark Theme**
- Premium dark color scheme
- Glassmorphism effects
- Smooth animations and transitions

### **Responsive Design**
- Works on desktop, tablet, and mobile
- Adaptive layouts
- Touch-friendly controls

### **Visual Feedback**
- Toast notifications for all actions
- Loading overlays for async operations
- Color-coded status indicators
- Animated charts and graphs

---

## 🔔 Notifications

### **Toast Messages**

Appear in the top-right corner for:
- ✅ **Success**: Green - Operations completed successfully
- ❌ **Error**: Red - Something went wrong
- ℹ️ **Info**: Blue - General information

Auto-dismiss after 5 seconds.

---

## 📈 Use Cases

### **1. Factory Manager Dashboard**

Monitor overall factory health:
1. Check KPI cards for quick overview
2. Review machine status for issues
3. Identify problematic production lines
4. Track defect trends

### **2. Quality Control**

Analyze defect patterns:
1. Go to **Analytics** tab
2. Query specific machines
3. Review defect rates
4. Identify trends over time

### **3. Real-Time Monitoring**

Watch live events:
1. Stay on **Overview** tab
2. Monitor recent events feed
3. Watch for warning badges
4. Check alerts tab for issues

### **4. Testing & Development**

Test the system:
1. Use **Simulate Events** button
2. Generate batch events
3. Verify processing speed
4. Check data accuracy

---

## 🎯 Tips & Tricks

### **Quick Demo**

1. Click **Simulate Events** (sidebar)
2. Watch the dashboard populate with data
3. Navigate through different tabs
4. Click **Generate Batch** for performance testing

### **Performance Testing**

1. Go to **Events** tab
2. Select a machine
3. Click **Generate Batch (100 events)**
4. Check processing time in result box
5. Should be < 100ms for 100 events

### **Health Monitoring**

- **Green badges** = Healthy (< 2.0 defects/hour)
- **Orange badges** = Warning (≥ 2.0 defects/hour)
- Check **Alerts** tab for critical issues

---

## 🔧 Customization

### **Change Refresh Interval**

Edit `app.js` line 3:
```javascript
const REFRESH_INTERVAL = 5000; // Change to desired ms
```

### **Add More Machines**

Edit machine dropdowns in `index.html`:
```html
<option value="M-004">M-004</option>
```

### **Customize Theme**

Edit `styles.css` CSS variables:
```css
:root {
    --primary: #6366f1;  /* Change primary color */
    --success: #10b981;  /* Change success color */
    /* ... */
}
```

---

## 🐛 Troubleshooting

### **Dashboard Not Loading**

1. Check server is running: `npm start`
2. Verify URL: `http://localhost:3000/index.html`
3. Check browser console for errors (F12)

### **No Data Showing**

1. Click **Simulate Events** button
2. Or manually ingest events via **Events** tab
3. Check browser console for API errors

### **API Errors**

1. Verify server is running on port 3000
2. Check CORS is enabled (already configured)
3. Review server logs for errors

---

## 📱 Browser Compatibility

**Recommended Browsers:**
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+

**Features Used:**
- CSS Grid & Flexbox
- CSS Variables
- Fetch API
- ES6+ JavaScript

---

## 🎓 For Presentations

### **Demo Script**

1. **Introduction** (30 seconds)
   - "This is a real-time factory monitoring dashboard"
   - "Tracks machine events, defects, and performance"

2. **Simulate Data** (10 seconds)
   - Click "Simulate Events"
   - "Watch as 20 events populate the system"

3. **Show Features** (1 minute)
   - Point out KPI cards
   - Show machine status
   - Highlight top defect lines
   - Scroll through recent events

4. **Navigate Tabs** (1 minute)
   - Click **Machines** - "Individual machine monitoring"
   - Click **Events** - "Manual event ingestion"
   - Click **Analytics** - "Query detailed statistics"

5. **Performance Demo** (30 seconds)
   - Go to **Events** tab
   - Click "Generate Batch (100 events)"
   - "Processed in ~50-100ms"

6. **Conclusion** (20 seconds)
   - "Production-ready dashboard"
   - "Real-time updates, beautiful UI"
   - "Connected to high-performance backend"

---

## 🌟 Key Highlights

- ✨ **Beautiful Design**: Modern dark theme with premium aesthetics
- ⚡ **Real-Time**: Live updates every 5 seconds
- 📊 **Comprehensive**: KPIs, charts, analytics, and alerts
- 🎯 **Interactive**: Click, simulate, and explore
- 📱 **Responsive**: Works on all devices
- 🚀 **Fast**: Smooth animations and instant updates

---

**Enjoy your Factory Monitoring Dashboard!** 🏭✨
