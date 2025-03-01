router.post('/forgot-password', async (req, res) => {
    const { username } = req.body;

    try {
        // Query the database for the user
        const user = await db.query('SELECT email, phone FROM users WHERE username = ?', [username]);
        
        if (!user.length) {
            return res.status(404).json({ message: 'Username not found' });
        }

        const { email, phone } = user[0];

        // Generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        
        // Store OTP in session or database with expiration (e.g., 10 minutes)
        req.session.otp = { code: otp, email, phone, expires: Date.now() + 600000 };

        // Send OTP via Email
        await transporter.sendMail({
            from: 'your-email@gmail.com',
            to: email,
            subject: 'Password Reset OTP',
            text: `Your OTP for password reset is: ${otp}. It expires in 10 minutes.`
        });

        // Send OTP via SMS
        await twilioClient.messages.create({
            body: `Your OTP for password reset is: ${otp}. It expires in 10 minutes.`,
            from: '+1234567890', // Your Twilio number
            to: phone
        });

        res.json({ message: 'OTP sent to your email and phone' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// OTP Verification Route
router.post('/verify-otp', (req, res) => {
    const { otp } = req.body;
    const storedOtp = req.session.otp;

    if (!storedOtp || storedOtp.expires < Date.now()) {
        return res.status(400).json({ message: 'OTP expired or invalid' });
    }

    if (storedOtp.code !== otp) {
        return res.status(400).json({ message: 'Incorrect OTP' });
    }

    // OTP is valid, clear it and allow password reset
    req.session.otpVerified = true;
    delete req.session.otp;

    res.json({ message: 'OTP verified', redirect: '/set-new-password' });
});

// Set New Password Route
router.post('/set-new-password', async (req, res) => {
    const { newPassword } = req.body;

    if (!req.session.otpVerified) {
        return res.status(403).json({ message: 'OTP verification required' });
    }

    try {
        // Hash the new password (use bcrypt or similar)
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password in the database
        await db.query('UPDATE users SET password = ? WHERE email = ?', 
            [hashedPassword, req.session.otp.email]);

        // Clear session data
        delete req.session.otpVerified;

        res.json({ message: 'Password updated successfully', redirect: '/login' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;