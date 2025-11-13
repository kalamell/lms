# LMS Docker Environment

## บริการที่รวมอยู่ในระบบ

1. **Node.js v24** - สำหรับ Application หลัก (Port 3000)
2. **MariaDB** - ฐานข้อมูล (Port 3306)
3. **phpMyAdmin** - จัดการฐานข้อมูล (Port 8080)
4. **Ant Media Server** - Streaming server (Ports 5080, 1935, 5443, 5000)
5. **Redis** - Cache system (Port 6379)
6. **Jenkins** - CI/CD (Port 8081, 50000)

## วิธีการติดตั้งและใช้งาน

### 1. เตรียม Project Structure

```bash
mkdir lms-project
cd lms-project
```

วาง `docker-compose.yml` ไว้ในโฟลเดอร์นี้

### 2. สร้างโฟลเดอร์สำหรับ Node.js Application

```bash
mkdir app
cd app
```

สร้างไฟล์ `package.json`:

```json
{
  "name": "lms-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "node server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.0",
    "redis": "^4.6.0"
  }
}
```

สร้างไฟล์ `server.js`:

```javascript
const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.json({ message: 'LMS API is running!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
```

กลับไปที่โฟลเดอร์หลัก:
```bash
cd ..
```

### 3. เริ่มต้นใช้งาน Docker

```bash
# สร้างและเริ่มต้นบริการทั้งหมด
docker-compose up -d

# ดูสถานะของ containers
docker-compose ps

# ดู logs
docker-compose logs -f

# ดู logs ของบริการเฉพาะ
docker-compose logs -f nodejs
```

### 4. เข้าถึงบริการต่างๆ

- **Node.js Application**: http://localhost:3000
- **phpMyAdmin**: http://localhost:8080
  - Username: `root`
  - Password: `root_password_change_me`
- **Ant Media Server**: http://localhost:5080
  - Default credentials: admin/admin (ต้องเปลี่ยนหลังเข้าใช้งานครั้งแรก)
- **Jenkins**: http://localhost:8081
  - Initial password: รันคำสั่ง `docker exec lms-jenkins cat /var/jenkins_home/secrets/initialAdminPassword`

### 5. การเชื่อมต่อฐานข้อมูลจาก Node.js

```javascript
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mariadb',
  user: process.env.DB_USER || 'lms_user',
  password: process.env.DB_PASSWORD || 'lms_password',
  database: process.env.DB_NAME || 'lms_database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
```

### 6. การเชื่อมต่อ Redis

```javascript
const redis = require('redis');

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
  password: 'redis_password_change_me'
});

client.connect();

module.exports = client;
```

## คำสั่งที่ใช้บ่อย

```bash
# หยุดบริการทั้งหมด
docker-compose down

# หยุดและลบ volumes (ระวัง: จะลบข้อมูลทั้งหมด)
docker-compose down -v

# Restart บริการเฉพาะ
docker-compose restart nodejs

# ดู logs แบบ real-time
docker-compose logs -f

# เข้าไปใน container
docker exec -it lms-nodejs sh
docker exec -it lms-mariadb bash

# สร้าง backup ฐานข้อมูล
docker exec lms-mariadb mysqldump -u root -proot_password_change_me lms_database > backup.sql

# Restore ฐานข้อมูล
docker exec -i lms-mariadb mysql -u root -proot_password_change_me lms_database < backup.sql
```

## ⚠️ สิ่งที่ควรทำก่อนใช้งานจริง (Production)

1. **เปลี่ยน Passwords ทั้งหมด**:
   - MariaDB root password
   - Database user password
   - Redis password

2. **ตั้งค่า Environment Variables** ผ่าน `.env` file

3. **เปิดใช้งาน HTTPS** สำหรับ Ant Media Server

4. **ตั้งค่า Volume Backup** สำหรับข้อมูลสำคัญ

5. **จำกัดการเข้าถึง Ports** ที่ไม่จำเป็นต้องเปิดสู่ภายนอก

6. **ตั้งค่า Memory และ CPU limits** สำหรับแต่ละ service

## การแก้ปัญหา

### ถ้า Node.js container ไม่สามารถเชื่อมต่อกับ MariaDB
- ตรวจสอบว่า MariaDB พร้อมใช้งานแล้ว: `docker-compose logs mariadb`
- รอให้ MariaDB initialize เสร็จก่อน (ประมาณ 30 วินาที)

### ถ้า Port ชนกัน
- เปลี่ยน port mapping ใน docker-compose.yml เช่น `"3001:3000"` แทน `"3000:3000"`

### ถ้าต้องการ rebuild image
```bash
docker-compose up -d --build
```

## ข้อมูลเพิ่มเติม

- Ant Media Server Documentation: https://github.com/ant-media/Ant-Media-Server
- Node.js Documentation: https://nodejs.org/docs/
- MariaDB Documentation: https://mariadb.org/documentation/
