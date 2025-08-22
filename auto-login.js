const puppeteer = require('puppeteer');

class EnvatoAutoLogin {
    constructor(email, password) {
        this.email = email;
        this.password = password;
        this.browser = null;
        this.page = null;
        this.cookies = null;
    }

    async initialize() {
        this.browser = await puppeteer.launch({
            headless: true,
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
        this.page = await this.browser.newPage();
        
        // Set user agent
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Set viewport
        await this.page.setViewport({ width: 1920, height: 1080 });
    }

    async login() {
        try {
            console.log('Navigating to Envato Elements...');
            await this.page.goto('https://elements.envato.com', { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait for and click the sign in button
            console.log('Looking for sign in button...');
            await this.page.waitForSelector('a[href*="signin"], button[data-testid*="signin"], .signin-btn', { timeout: 10000 });
            
            const signInSelector = await this.page.evaluate(() => {
                const selectors = [
                    'a[href*="signin"]',
                    'button[data-testid*="signin"]',
                    '.signin-btn',
                    '[data-testid="header-sign-in"]',
                    'a[href*="account.envato.com"]'
                ];
                
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) return selector;
                }
                return null;
            });

            if (signInSelector) {
                console.log('Clicking sign in button...');
                await this.page.click(signInSelector);
                await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
            }

            // Fill in login form
            console.log('Filling login form...');
            await this.page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 10000 });
            
            const emailSelector = await this.page.evaluate(() => {
                const selectors = ['input[type="email"]', 'input[name="email"]', '#email', '[data-testid="email"]'];
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) return selector;
                }
                return 'input[type="email"]';
            });

            const passwordSelector = await this.page.evaluate(() => {
                const selectors = ['input[type="password"]', 'input[name="password"]', '#password', '[data-testid="password"]'];
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) return selector;
                }
                return 'input[type="password"]';
            });

            await this.page.type(emailSelector, this.email, { delay: 100 });
            await this.page.type(passwordSelector, this.password, { delay: 100 });

            // Submit form
            console.log('Submitting login form...');
            const submitSelector = await this.page.evaluate(() => {
                const selectors = [
                    'button[type="submit"]',
                    'input[type="submit"]',
                    'button:has-text("Sign In")',
                    'button:has-text("Log In")',
                    '.login-button',
                    '[data-testid="login-submit"]'
                ];
                
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && !element.disabled) return selector;
                }
                return 'button[type="submit"]';
            });

            await this.page.click(submitSelector);
            
            // Wait for login to complete
            console.log('Waiting for login to complete...');
            await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

            // Check if login was successful
            const currentUrl = this.page.url();
            if (currentUrl.includes('elements.envato.com') && !currentUrl.includes('signin') && !currentUrl.includes('login')) {
                console.log('Login successful!');
                
                // Get cookies
                this.cookies = await this.page.cookies();
                console.log('Retrieved cookies:', this.cookies.length);
                
                return {
                    success: true,
                    cookies: this.cookies,
                    url: currentUrl
                };
            } else {
                console.log('Login may have failed, checking page content...');
                const pageContent = await this.page.content();
                if (pageContent.includes('dashboard') || pageContent.includes('account') || pageContent.includes('profile')) {
                    this.cookies = await this.page.cookies();
                    return {
                        success: true,
                        cookies: this.cookies,
                        url: currentUrl
                    };
                }
                
                throw new Error('Login failed - still on login page');
            }

        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getCookieString() {
        if (!this.cookies) return '';
        return this.cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    }

    getCookiesObject() {
        if (!this.cookies) return {};
        const cookieObj = {};
        this.cookies.forEach(cookie => {
            cookieObj[cookie.name] = cookie.value;
        });
        return cookieObj;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = EnvatoAutoLogin;