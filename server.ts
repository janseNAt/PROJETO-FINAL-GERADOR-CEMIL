import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { parse } from "node-html-parser";
import axios from "axios";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { 
  Document, Packer, Paragraph, TextRun, SectionType, 
  AlignmentType, BorderStyle, HeadingLevel, ImageRun
} from "docx";

const db = new Database("saas_exams_v3.db");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-cemil";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT,
    logo_url TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT, -- 'admin' or 'professor'
    must_change_password INTEGER DEFAULT 0
    
  );
-- ADICIONE ESTE BLOCO AQUI:
  CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    blocks TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO schools (id, name, logo_url) 
  VALUES ('school-1', 'Instituto de Educação Avançada', 'https://picsum.photos/seed/school/200/100');
`);

// Seed Admin User (password: admin123)
const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
if (!adminExists) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (id, name, email, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, ?, ?)")
    .run(Math.random().toString(36).substr(2, 9), "Administrador", "admin@cemil.com", hash, "admin", 0);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // --- MIDDLEWARES ---

  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Não autenticado" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Token inválido" });
    }
  };

  const authorize = (roles: string[]) => (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };

  // --- AUTH ROUTES ---

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "8h" });
    
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    res.json({ 
      id: user.id, 
      name: user.name, 
      role: user.role, 
      mustChangePassword: !!user.must_change_password 
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.get("/api/auth/me", authenticate, (req: any, res) => {
    res.json(req.user);
  });

  app.post("/api/auth/reset-password", authenticate, (req: any, res) => {
    const { newPassword } = req.body;
    const hash = bcrypt.hashSync(newPassword, 10);
    
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
      .run(hash, req.user.id);
    
    res.json({ success: true });
  });

  // --- ADMIN ROUTES ---

  app.post("/api/admin/add-professor", authenticate, authorize(['admin']), (req, res) => {
    const { name, email, tempPassword } = req.body;
    const hash = bcrypt.hashSync(tempPassword, 10);
    
    try {
      db.prepare("INSERT INTO users (id, name, email, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, ?, ?)")
        .run(Math.random().toString(36).substr(2, 9), name, email, hash, "professor", 1);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "E-mail já cadastrado" });
    }
  });

  app.get("/api/admin/professors", authenticate, authorize(['admin']), (req, res) => {
    const professors = db.prepare("SELECT id, name, email FROM users WHERE role = 'professor'").all();
    res.json(professors);
  });

  app.delete("/api/admin/professor/:id", authenticate, authorize(['admin']), (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM users WHERE id = ? AND role = 'professor'").run(id);
    res.json({ success: true });
  });

  // --- DOCX LOGIC ---
  // ... (keep processImage and htmlToTextRuns as they are)
  async function processImage(url: string) {
    try {
      if (url.startsWith('data:')) {
        const base64Data = url.split(';base64,').pop();
        if (!base64Data) return null;
        const buffer = Buffer.from(base64Data, 'base64');
        return { buffer, width: 250, height: 180 }; // Redimensionamento fixo para segurança
      }
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      return { buffer, width: 250, height: 180 };
    } catch (e) {
      return null;
    }
  }

  // Helper to convert HTML to TextRuns (preserving only bold, italics, underline)
  // and enforcing Times New Roman 12pt (size 24)
  function htmlToTextRuns(htmlNode: any) {
    const runs: any[] = [];
    
    function traverse(node: any, formatting: any = {}) {
      if (node.nodeType === 3) { // Text Node
        const text = node.text;
        if (text) {
          runs.push(new TextRun({
            text: text,
            bold: formatting.bold,
            italics: formatting.italics,
            underline: formatting.underline ? {} : undefined,
            size: 24,
            font: "Times New Roman"
          }));
        }
      } else if (node.nodeType === 1) { // Element Node
        const tag = node.tagName.toLowerCase();
        const newFormatting = { ...formatting };
        if (tag === 'b' || tag === 'strong') newFormatting.bold = true;
        if (tag === 'i' || tag === 'em') newFormatting.italics = true;
        if (tag === 'u') newFormatting.underline = true;
        
        // We ignore any other tags (like span with styles) and just process children
        for (const child of node.childNodes) {
          traverse(child, newFormatting);
        }
      }
    }

    for (const child of htmlNode.childNodes) {
      traverse(child);
    }
    return runs;
  }

  // API: Export DOCX with Automatic Numbering and 2 Columns
  app.post("/api/export-docx", authenticate, async (req, res) => {
    const { school, exam } = req.body;
    const { title, blocks } = exam;

    // 1. Header Section (1 Column)
    const headerChildren = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: school.name, bold: true, size: 24, font: "Times New Roman" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: title, size: 24, italics: true, font: "Times New Roman" })],
      }),
      new Paragraph({
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: "Aluno: _________________________________________________ Turma: ________ Data: ___/___/___", size: 24, font: "Times New Roman" })],
        border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 } }
      }),
    ];

    // 2. Body Section (2 Columns)
    const bodyChildren: any[] = [];
    const answerKey: string[] = [];
    let questionCounter = 1;

    for (const block of blocks) {
      if (block.tipo === 'texto_apoio') {
        const html = block.conteudoHtml || "";
        const root = parse(html);
        
        // If the root has no element children, it might be just raw text
        const hasElements = root.childNodes.some(n => n.nodeType === 1);
        
        if (!hasElements && html.trim()) {
          // Handle raw text by wrapping it in a justified paragraph
          bodyChildren.push(new Paragraph({
            children: [new TextRun({ text: html, size: 24, font: "Times New Roman" })],
            spacing: { after: 120 },
            alignment: AlignmentType.JUSTIFIED
          }));
        } else {
          for (const node of root.childNodes) {
            if (node.nodeType === 1) {
              const el = node as any;
              if (el.tagName === 'P') {
                bodyChildren.push(new Paragraph({
                  children: htmlToTextRuns(el),
                  spacing: { after: 120 },
                  alignment: AlignmentType.JUSTIFIED
                }));
              } else if (el.tagName === 'IMG') {
                const imgData = await processImage(el.getAttribute('src'));
                if (imgData) {
                  bodyChildren.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({ 
                      data: imgData.buffer, 
                      transformation: { width: imgData.width, height: imgData.height } 
                    } as any)],
                  }));
                }
              }
            } else if (node.nodeType === 3 && node.text.trim()) {
              // Handle text nodes at root level
              bodyChildren.push(new Paragraph({
                children: [new TextRun({ text: node.text, size: 24, font: "Times New Roman" })],
                spacing: { after: 120 },
                alignment: AlignmentType.JUSTIFIED
              }));
            }
          }
        }
      } 
      
      else if (block.tipo === 'image') {
        const content = block.content;
        const imgData = await processImage(content.base64);
        if (imgData) {
          bodyChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ 
              data: imgData.buffer, 
              transformation: { width: imgData.width, height: imgData.height } 
            } as any)],
            spacing: { before: 200, after: 100 }
          }));
          if (content.caption) {
            bodyChildren.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: content.caption, size: 16, italics: true, color: "666666", font: "Times New Roman" })],
              spacing: { after: 200 }
            }));
          }
        }
      }

      else if (block.tipo === 'question') {
        const content = block.content;
        const qPrefix = `Questão ${questionCounter} - `;
        
        // Question Header - Left Aligned
        bodyChildren.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({ text: qPrefix, bold: true, size: 24, font: "Times New Roman" }),
            new TextRun({ text: content.enunciado || "", size: 24, font: "Times New Roman" })
          ],
          spacing: { before: 300 }
        }));

        // Question Image
        if (content.imagemBase64) {
          const qImgData = await processImage(content.imagemBase64);
          if (qImgData) {
            bodyChildren.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({ 
                data: qImgData.buffer, 
                transformation: { width: qImgData.width, height: qImgData.height } 
              } as any)],
              spacing: { before: 100, after: 100 }
            }));
          }
        }

        if (content.tipo === 'objetiva' && content.alternativas) {
          content.alternativas.forEach((alt: any, i: number) => {
            bodyChildren.push(new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: `${alt.letra}) ${alt.texto}`, size: 24, font: "Times New Roman" })],
              indent: { left: 360 }
            }));
            if (alt.correta) {
              answerKey.push(`${questionCounter}: ${alt.letra}`);
            }
          });
        } else if (content.lines) {
          // Discursive lines
          for (let i = 0; i < content.lines; i++) {
            bodyChildren.push(new Paragraph({
              children: [new TextRun({ text: "____________________________________________________", color: "BBBBBB", size: 24, font: "Times New Roman" })],
              spacing: { after: 100 }
            }));
          }
        }
        questionCounter++;
      }
    }

    // 3. Answer Key Section
    const footerChildren = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "GABARITO", bold: true, size: 24, font: "Times New Roman" })],
        spacing: { before: 400, after: 400 }
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: answerKey.join(" | "), size: 24, font: "Times New Roman" })]
      })
    ];

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              size: 24,
              font: "Times New Roman",
            },
          },
        },
      },
      sections: [
        {
          properties: { type: SectionType.CONTINUOUS },
          children: headerChildren,
        },
        {
          properties: {
            type: SectionType.CONTINUOUS,
            column: { count: 2, space: 720 },
          },
          children: bodyChildren,
        },
        {
          properties: { type: SectionType.NEXT_PAGE },
          children: footerChildren,
        }
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Disposition", `attachment; filename=prova.docx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.send(buffer);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
