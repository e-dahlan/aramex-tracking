const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.get('/track', async (req, res) => {
    const trackingNum = req.query.num;

    if (!trackingNum) {
        return res.status(400).json({ error: 'الرجاء إدخال رقم الشحنة' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        let apiData = null;

        // التقاط الرد المباشر من API أرامكس (تغطية GET و POST)
        page.on('response', async (response) => {
            const url = response.url().toLowerCase();
            if (url.includes('track') || url.includes('shipment')) {
                try {
                    const contentType = response.headers()['content-type'] || '';
                    if (contentType.includes('application/json')) {
                        const json = await response.json();
                        // التأكد من أن الكائن يحتوي على بيانات تتبع فعلية
                        if (json && (json.TrackingResults || json.data || json.Value || json.HasErrors !== undefined)) {
                            apiData = json;
                        }
                    }
                } catch (e) {}
            }
        });

        const targetUrl = `https://www.aramex.com/sa/en/track/results?source=aramex&ShipmentNumber=${encodeURIComponent(trackingNum)}`;
        
        // فتح الصفحة وانتظار هدوء الشبكة لضمان اكتمال طلبات الـ XHR/Fetch
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });

        // انتظار إضافي بسيط لتنفيذ السكربتات
        await delay(2000);

        // إذا لم يلتقط الـ Response Listener البيانات، نحاول تنفيذ الطلب مباشرة داخل جلسة المتصفح الموثوقة
        if (!apiData) {
            apiData = await page.evaluate(async (num) => {
                try {
                    const res = await fetch(`https://www.aramex.com/api/shipment/track?trackingNumbers=${num}`);
                    return await res.json();
                } catch (err) {
                    return null;
                }
            }, trackingNum);
        }

        await browser.close();

        if (apiData) {
            return res.json({
                success: true,
                trackingNum,
                data: apiData
            });
        } else {
            return res.status(404).json({
                error: 'لم يتم العثور على بيانات للشحنة، تأكد من صحة الرقم.'
            });
        }

    } catch (error) {
        if (browser) await browser.close();
        console.error('Puppeteer Error Details:', error.message);
        return res.status(500).json({ error: `حدث خطأ: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
