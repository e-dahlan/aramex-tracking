const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

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

        // 🚀 تسريع التحميل وتقليل استهلاك الذاكرة بحظر الصور والملفات الثقيلة
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        let apiData = null;

        // التقاط الـ API الداخلي
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/') || url.includes('track') || url.includes('Shipment')) {
                try {
                    const contentType = response.headers()['content-type'];
                    if (contentType && contentType.includes('application/json')) {
                        const json = await response.json();
                        if (json && (json.TrackingResults || json.data || json.Value)) {
                            apiData = json;
                        }
                    }
                } catch (e) {}
            }
        });

        const targetUrl = `https://www.aramex.com/sa/en/track/results?source=aramex&ShipmentNumber=${encodeURIComponent(trackingNum)}`;
        
        // وقت انتظار أسرع بكثير بعد حظر الصور
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

        // الانتظار القصير للتأكد من وصول بيانات الـ API
        await page.waitForTimeout(3000);

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
        return res.status(500).json({ error: 'حدث خطأ أثناء الاتصال بأرامكس، حاول مرة أخرى.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
