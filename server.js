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
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });

        const page = await browser.newPage();
        
        // ضبط هيدرز كمتصفح حقيقي بالكامل
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
        });

        let apiData = null;

        // التقاط الرد المباشر من API أرامكس الداخلي عند تحميل الصفحة
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/shipment/track') || url.includes('/Shipment/Track')) {
                try {
                    apiData = await response.json();
                } catch (e) {
                    // في حال لم يكن الرد JSON
                }
            }
        });

        // الانتقال لصفحة التتبع العامة
        const targetUrl = `https://www.aramex.com/express-courier/track-shipments?shipmentNumber=${encodeURIComponent(trackingNum)}`;
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });

        await browser.close();

        if (apiData) {
            return res.json({
                success: true,
                trackingNum,
                data: apiData
            });
        } else {
            return res.status(404).json({
                error: 'لم يتم العثور على بيانات للشحنة أو لم يستجب السيرفر الداخلي'
            });
        }

    } catch (error) {
        if (browser) await browser.close();
        console.error('Puppeteer Error:', error);
        return res.status(500).json({ error: 'حدث خطأ أثناء الاتصال بأرامكس، حاول مرة أخرى.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
