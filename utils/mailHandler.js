const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 25,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "9d63feaa72c33b",
        pass: "e125912555485c",
    },
});

module.exports = {
    sendMail: async (to,url) => {
        const info = await transporter.sendMail({
            from: 'admin@haha.com',
            to: to,
            subject: "RESET PASSWORD REQUEST",
            text: "lick vo day de doi pass", // Plain-text version of the message
            html: "lick vo <a href="+url+">day</a> de doi pass", // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    },
    sendNewUserPasswordMail: async (to, username, password) => {
        const info = await transporter.sendMail({
            from: 'admin@haha.com',
            to: to,
            subject: "TAI KHOAN MOI",
            text: `Tai khoan cua ban da duoc tao. Username: ${username}. Mat khau tam: ${password}`,
            html: `<p>Tai khoan cua ban da duoc tao.</p><p><b>Username:</b> ${username}</p><p><b>Mat khau tam:</b> ${password}</p><p>Vui long dang nhap va doi mat khau.</p>`
        });

        console.log("New user mail sent:", info.messageId);
    }
}