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
        // تشغيل متصفح بدون واجهة (Headless)
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ]
        });

        const page = await browser.newPage();
        
        // التمويه كمتصفح حقيقي
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // فتح صفحة التتبع الخاصة بـ أرامكس
        const targetUrl = `https://www.aramex.com/express-courier/track-shipments?shipmentNumber=${encodeURIComponent(trackingNum)}`;
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // استخراج البيانات المباشرة من عناصر الـ DOM في أرامكس
        const trackingData = await page.evaluate(() => {
            const rows = document.querySelectorAll('.tracking-results-table tbody tr, .tracking-events-list .event-item');
            const events = [];

            rows.forEach(row => {
                const title = row.querySelector('.status, .event-title, td:nth-child(2)')?.innerText?.trim() || '';
                const location = row.querySelector('.location, td:nth-child(3)')?.innerText?.trim() || '';
                const date = row.querySelector('.date, td:nth-child(1)')?.innerText?.trim() || '';

                if (title) {
                    events.push({ title, location, date });
                }
            });

            return events;
        });

        await browser.close();

        return res.json({
            success: true,
            trackingNum,
            events: trackingData
        });

    } catch (error) {
        if (browser) await browser.close();
        console.error('Scraping Error:', error);
        return res.status(500).json({ error: 'تعذر جلب البيانات من أرامكس، تأكد من الرقم وحاول مجدداً.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
