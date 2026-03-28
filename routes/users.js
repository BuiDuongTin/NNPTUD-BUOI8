var express = require("express");
var router = express.Router();
const path = require("path");
const crypto = require("crypto");
const ExcelJS = require("exceljs");
let { validatedResult, CreateAnUserValidator, ModifyAnUserValidator } = require('../utils/validator')
let userModel = require("../schemas/users");
let roleModel = require("../schemas/roles");
let userController = require('../controllers/users')
let { CheckLogin, CheckRole } = require('../utils/authHandler')
let { sendNewUserPasswordMail } = require('../utils/mailHandler')

function generateRandomPassword(length = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let result = "";
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, chars.length);
    result += chars[idx];
  }
  return result;
}

function getCellText(cell) {
  if (!cell) return "";
  const raw = cell.value;
  if (!raw && raw !== 0) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "object") {
    if (raw.text && typeof raw.text === "string") return raw.text;
    if (raw.hyperlink) return String(raw.text || raw.hyperlink);
    if (Array.isArray(raw.richText)) {
      return raw.richText.map((r) => r.text || "").join("");
    }
  }
  return String(raw);
}

router.get("/", CheckLogin,CheckRole("ADMIN", "USER"), async function (req, res, next) {
    let users = await userModel
      .find({ isDeleted: false })
    res.send(users);
  });

router.post("/import", CheckLogin, CheckRole("ADMIN"), async function (req, res, next) {
  try {
    const excelPath = path.join(process.cwd(), "user.xlsx");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).send({ message: "Khong tim thay sheet du lieu trong user.xlsx" });
    }

    let userRole = await roleModel.findOne({ name: /^user$/i, isDeleted: false });
    if (!userRole) {
      // Tạo role user nếu đang chưa tồn tại
      userRole = new roleModel({ name: 'user', description: 'Role user mặc định' });
      await userRole.save();
    }

    const headerRow = worksheet.getRow(1);
    const headers = (headerRow.values || []).map((item) =>
      String(item || "").trim().toLowerCase()
    );
    const usernameIndex = headers.indexOf("username");
    const emailIndex = headers.indexOf("email");

    const report = {
      totalRows: worksheet.rowCount,
      imported: 0,
      skipped: 0,
      mailSent: 0,
      errors: []
    };

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const fallbackUsername = getCellText(row.getCell(1)).trim();
      const fallbackEmail = getCellText(row.getCell(2)).trim().toLowerCase();

      const usernameCell = usernameIndex > -1 ? getCellText(row.getCell(usernameIndex)) : fallbackUsername;
      const emailCell = emailIndex > -1 ? getCellText(row.getCell(emailIndex)) : fallbackEmail;

      let username = usernameCell.trim();
      const email = (emailCell || "").trim().toLowerCase();

      if (!email) {
        report.skipped++;
        continue;
      }

      if (!username) {
        username = email.split("@")[0];
      }

      const existed = await userModel.findOne({
        isDeleted: false,
        $or: [{ username }, { email }]
      });
      if (existed) {
        report.skipped++;
        continue;
      }

      const password = generateRandomPassword(16);
      const newUser = new userModel({
        username,
        email,
        password,
        role: userRole._id,
        status: false,
        loginCount: 0
      });

      await newUser.save();
      report.imported++;

      try {
        await sendNewUserPasswordMail(email, username, password);
        report.mailSent++;
      } catch (mailErr) {
        report.errors.push({
          row: i,
          email,
          error: "Tao user thanh cong nhung gui mail that bai",
          mailErr: mailErr.message || String(mailErr)
        });
        console.error("Email send failed for row", i, "email", email, mailErr);
      }
    }

    res.send(report);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get("/:id", async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let newItem = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email, req.body.role,
      req.body.fullName, req.body.avatarUrl, req.body.status, req.body.loginCount)
    res.send(newItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", ModifyAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;