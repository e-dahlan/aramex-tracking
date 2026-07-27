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

        // إعداد أبعاد المتصفح والهيدرز كمتصفح حقيقي
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        const targetUrl = `https://www.aramex.com/sa/en/track/results?source=aramex&ShipmentNumber=${encodeURIComponent(trackingNum)}`;
        
        // الانتقال لصفحة التتبع مع الانتظار لاكتمال تحميل الـ DOM
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 40000 });

        // انتظار إضافي لاكتمال رندر عناصر الصفحة
        await delay(3000);

        // استخراج البيانات المباشرة من عناصر DOM في صفحة أرامكس
        const trackingDetails = await page.evaluate(() => {
            const events = [];
            
            // قراءة جميع الصفوف أو أجزاء التتبع المتاحة في الصفحة
            const elements = document.querySelectorAll('.tracking-results-table tbody tr, .tracking-update, .shipment-history-item, tr');
            
            elements.forEach(el => {
                const text = el.innerText ? el.innerText.trim() : '';
                if (text && text.length > 5) {
                    events.push(text.split('\n').map(item => item.trim()).filter(Boolean));
                }
            });

            // قراءة الحالة العامة أو العنوان الرئيسي للشحنة إن وجد
            const statusSummary = document.querySelector('.shipment-status, .status-title, h3, h4')?.innerText?.trim() || '';

            return {
                statusSummary,
                history: events
            };
        });

        await browser.close();

        if (trackingDetails && (trackingDetails.history.length > 0 || trackingDetails.statusSummary)) {
            return res.json({
                success: true,
                trackingNum,
                data: trackingDetails
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
