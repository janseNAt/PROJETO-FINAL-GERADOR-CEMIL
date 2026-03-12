/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, FileText, Download, 
  Type, ListChecks, AlignLeft, Loader2, 
  Image as ImageIcon, GripVertical, CheckCircle2,
  Settings, User, ChevronRight, Hash, LogOut,
  ShieldCheck, Users, Key, AlertCircle
} from 'lucide-react';

interface Block {
  id: string;
  type: 'texto_apoio' | 'question' | 'image';
  content: any;
}

interface UserData {
  id: string;
  name: string;
  role: 'admin' | 'professor';
  mustChangePassword?: boolean;
}

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'editor' | 'admin'>('editor');
  
  // Editor States
  const [school, setSchool] = useState<any>({ name: 'Instituto de Educação Avançada', logo_url: 'https://picsum.photos/seed/school/200/100' });
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState('Avaliação');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.error("Auth check failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setView('editor');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  if (user.mustChangePassword) {
    return <PasswordResetScreen onComplete={() => setUser({ ...user, mustChangePassword: false })} />;
  }

  if (user.role === 'admin' && view === 'admin') {
    return <AdminDashboard onBack={() => setView('editor')} onLogout={handleLogout} />;
  }

  // --- EDITOR LOGIC ---

  const addBlock = (type: 'texto_apoio' | 'question' | 'image', data?: any) => {
    const newBlock: Block = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: type === 'texto_apoio' ? { html: 'Digite seu texto aqui...' } :
               type === 'image' ? { base64: data || '', caption: '' } :
               { 
                 enunciado: '', 
                 imagemBase64: null, 
                 alternativas: [
                   { letra: 'A', texto: '', correta: false },
                   { letra: 'B', texto: '', correta: false },
                   { letra: 'C', texto: '', correta: false },
                   { letra: 'D', texto: '', correta: false }
                 ] 
               }
    };
    setBlocks([...blocks, newBlock]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, blockId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (blockId) {
        const block = blocks.find(b => b.id === blockId);
        if (block) {
          updateBlock(blockId, { ...block.content, imagemBase64: base64String });
        }
      } else {
        addBlock('image', base64String);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const updateBlock = (id: string, content: any) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const formattedBlocks = blocks.map(block => {
        if (block.type === 'question') {
          return {
            tipo: 'question',
            content: {
              tipo: "objetiva",
              numero: getQuestionNumber(block.id),
              enunciado: block.content.enunciado,
              imagemBase64: block.content.imagemBase64,
              alternativas: block.content.alternativas
            }
          };
        }
        if (block.type === 'texto_apoio') {
          return {
            tipo: 'texto_apoio',
            conteudoHtml: block.content.html
          };
        }
        return {
          tipo: block.type,
          content: block.content
        };
      });

      const res = await fetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school, exam: { title, blocks: formattedBlocks } })
      });
      
      if (!res.ok) throw new Error("Falha na exportação");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar DOCX. Verifique se sua sessão ainda é válida.');
    } finally {
      setExporting(false);
    }
  };

  const getQuestionNumber = (blockId: string) => {
    const questionBlocks = blocks.filter(b => b.type === 'question');
    const index = questionBlocks.findIndex(b => b.id === blockId);
    return index + 1;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-indigo-100 shadow-lg">
              <FileText className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">Cemil Provas</span>
          </div>
          
          <nav className="space-y-1">
            <NavItem icon={<FileText className="w-4 h-4" />} label="Editor de Prova" active onClick={() => setView('editor')} />
            {user.role === 'admin' && (
              <NavItem icon={<ShieldCheck className="w-4 h-4" />} label="Painel Admin" onClick={() => setView('admin')} />
            )}
          </nav>
        </div>

        <div className="p-6 flex-1">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Construtor</h3>
          <div className="space-y-3">
            <BlockAction icon={<Type />} label="Texto de Apoio" onClick={() => addBlock('texto_apoio')} />
            <div className="relative">
              <BlockAction icon={<ImageIcon />} label="Inserir Imagem" onClick={() => document.getElementById('sidebar-image-upload')?.click()} />
              <input 
                id="sidebar-image-upload"
                type="file" 
                accept="image/jpeg, image/png" 
                className="hidden" 
                onChange={(e) => handleImageUpload(e)}
              />
            </div>
            <BlockAction icon={<Hash />} label="Nova Questão" onClick={() => addBlock('question')} />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                {user.name.charAt(0)}
              </div>
              <div className="text-[10px]">
                <p className="font-bold text-slate-700 leading-tight">{user.name}</p>
                <p className="text-slate-400 uppercase tracking-tighter">{user.role}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-300 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Editor Area */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-10 py-5 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">Provas</span>
            <ChevronRight className="w-3 h-3" />
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="font-bold text-slate-800 bg-transparent border-none focus:ring-0 p-0 text-lg"
            />
          </div>
          <button 
            onClick={handleExport}
            disabled={exporting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-indigo-100 shadow-lg disabled:opacity-50 active:scale-95"
          >
            {exporting ? <Loader2 className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}
            Exportar .DOCX
          </button>
        </header>

        <div className="flex-1 p-10 overflow-y-auto flex justify-center bg-slate-50/30">
          <div className="w-full max-w-4xl space-y-8">
            {blocks.map((block, idx) => (
              <div key={block.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-shadow relative">
                <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {block.type === 'question' ? `Questão ${getQuestionNumber(block.id)}` : 
                       block.type === 'texto_apoio' ? 'Texto de Apoio' : 'Imagem / Recurso Visual'}
                    </span>
                  </div>
                  <button 
                    onClick={() => removeBlock(block.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl"
                    title="Excluir este bloco"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-8">
                  {block.type === 'image' && (
                    <div className="space-y-4">
                      <div className="relative group/img rounded-2xl overflow-hidden border-2 border-slate-100">
                        <img src={block.content.base64} className="w-full max-h-[400px] object-contain bg-slate-50" alt="Upload" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                           <button 
                            onClick={() => document.getElementById(`change-img-${block.id}`)?.click()}
                            className="bg-white text-slate-800 px-4 py-2 rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform"
                           >
                             Alterar Imagem
                           </button>
                           <input 
                              id={`change-img-${block.id}`}
                              type="file" 
                              accept="image/jpeg, image/png" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => updateBlock(block.id, { ...block.content, base64: reader.result as string });
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                        </div>
                      </div>
                      <input 
                        placeholder="Legenda da imagem (opcional)..."
                        value={block.content.caption}
                        onChange={e => updateBlock(block.id, { ...block.content, caption: e.target.value })}
                        className="w-full bg-transparent border-b border-slate-100 focus:border-indigo-500 focus:ring-0 p-2 text-sm text-slate-500 italic"
                      />
                    </div>
                  )}

                  {block.type === 'texto_apoio' && (
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Texto Base / Crônica / Poema</label>
                      <textarea 
                        placeholder="Digite seu texto ou cole HTML aqui..."
                        value={block.content.html}
                        onChange={e => updateBlock(block.id, { ...block.content, html: e.target.value })}
                        className="w-full border-2 border-slate-50 focus:border-indigo-100 focus:ring-0 p-4 text-slate-700 rounded-2xl min-h-[150px] font-serif text-lg leading-relaxed"
                      />
                    </div>
                  )}

                  {block.type === 'question' && (
                    <div className="space-y-8">
                      <div className="flex gap-4">
                        <div className="bg-indigo-600 text-white font-bold w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-lg shadow-indigo-100 shrink-0">
                          {getQuestionNumber(block.id)}
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">Enunciado da Questão</label>
                          <textarea 
                            placeholder="Digite o enunciado da pergunta..."
                            value={block.content.enunciado}
                            onChange={e => updateBlock(block.id, { ...block.content, enunciado: e.target.value })}
                            className="w-full border-none focus:ring-0 p-0 text-slate-800 font-bold text-xl resize-none placeholder:text-slate-300"
                            rows={3}
                          />
                          
                          <div className="mt-4 flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                              <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" />
                                {block.content.imagemBase64 ? 'Alterar Imagem da Questão' : 'Adicionar Imagem à Questão'}
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => handleImageUpload(e, block.id)}
                                />
                              </label>
                              {block.content.imagemBase64 && (
                                <button 
                                  onClick={() => updateBlock(block.id, { ...block.content, imagemBase64: null })}
                                  className="text-red-500 hover:text-red-600 text-xs font-bold uppercase"
                                >
                                  Remover Imagem
                                </button>
                              )}
                            </div>

                            {block.content.imagemBase64 && (
                              <div className="relative group/qimg w-fit max-w-full">
                                <img 
                                  src={block.content.imagemBase64} 
                                  className="max-h-[300px] rounded-2xl border-2 border-slate-100 shadow-sm" 
                                  alt="Preview" 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pl-16">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest">Alternativas</label>
                        <div className="grid gap-4">
                          {block.content.alternativas.map((alt: any, index: number) => (
                            <div key={index} className="flex items-center gap-4 group">
                              <input 
                                type="radio" 
                                name={`gabarito-${block.id}`}
                                checked={alt.correta}
                                onChange={() => {
                                  const newAlts = block.content.alternativas.map((a: any, i: number) => ({
                                    ...a,
                                    correta: i === index
                                  }));
                                  updateBlock(block.id, { ...block.content, alternativas: newAlts });
                                }}
                                className="w-6 h-6 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                              />
                              <div className="flex-1 flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border-2 border-transparent focus-within:border-indigo-100 focus-within:bg-white transition-all">
                                <span className="font-bold text-slate-400 w-8 text-lg">({alt.letra})</span>
                                <input 
                                  value={alt.texto}
                                  onChange={e => {
                                    const newAlts = [...block.content.alternativas];
                                    newAlts[index].texto = e.target.value;
                                    updateBlock(block.id, { ...block.content, alternativas: newAlts });
                                  }}
                                  placeholder={`Texto da alternativa ${alt.letra}...`}
                                  className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-slate-700 text-lg placeholder:text-slate-300"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {block.content.alternativas.length < 5 && (
                          <button 
                            onClick={() => {
                              const nextLetter = String.fromCharCode(65 + block.content.alternativas.length);
                              const newAlts = [
                                ...block.content.alternativas,
                                { letra: nextLetter, texto: '', correta: false }
                              ];
                              updateBlock(block.id, { ...block.content, alternativas: newAlts });
                            }}
                            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-sm px-6 py-3 rounded-2xl hover:bg-indigo-50 transition-colors border-2 border-dashed border-indigo-100 mt-2"
                          >
                            <Plus className="w-5 h-5" /> Adicionar Alternativa ({String.fromCharCode(65 + block.content.alternativas.length)})
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-center pt-4 pb-20">
              <button 
                onClick={() => addBlock('question')}
                className="group bg-white border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 w-full py-10 rounded-[40px] transition-all flex flex-col items-center gap-4 text-slate-400 hover:text-indigo-600 shadow-sm hover:shadow-md"
              >
                <div className="bg-slate-100 group-hover:bg-indigo-100 p-5 rounded-2xl transition-colors">
                  <Plus className="w-10 h-10" />
                </div>
                <div className="text-center">
                  <span className="font-bold text-xl tracking-tight uppercase block">Adicionar Nova Questão</span>
                  <span className="text-xs font-medium opacity-60">Clique para inserir uma nova questão objetiva à prova</span>
                </div>
              </button>
            </div>

            {blocks.length === 0 && (
              <div className="py-32 flex flex-col items-center justify-center text-slate-300 border-4 border-dashed border-slate-200 rounded-[40px] bg-white/50">
                <div className="bg-white p-6 rounded-3xl shadow-sm mb-6">
                  <Plus className="w-12 h-12 text-indigo-200" />
                </div>
                <h3 className="text-xl font-bold text-slate-400 mb-2">Sua prova está em branco</h3>
                <p className="text-slate-400 max-w-xs text-center text-sm">Use os botões da barra lateral para adicionar textos, imagens e questões numeradas.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- AUTH COMPONENTS ---

function LoginScreen({ onLogin }: { onLogin: (u: UserData) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-xl shadow-slate-200/50 p-10 border border-slate-100">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-100 mb-4">
            <FileText className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cemil Provas</h1>
          <p className="text-slate-400 text-sm">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm flex items-center gap-3 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl p-4 transition-all outline-none"
              placeholder="exemplo@cemil.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Palavra-passe</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl p-4 transition-all outline-none"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar no Sistema"}
          </button>
        </form>
        
        <div className="mt-8 pt-8 border-t border-slate-50 text-center">
          <p className="text-xs text-slate-400">Dica: entre em contato com o TI da escola</p>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ onBack, onLogout }: { onBack: () => void, onLogout: () => void }) {
  const [professors, setProfessors] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tempPass, setTempPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfessors();
  }, []);

  const fetchProfessors = async () => {
    const res = await fetch('/api/admin/professors');
    if (res.ok) setProfessors(await res.json());
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/add-professor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, tempPassword: tempPass })
    });
    if (res.ok) {
      setName(''); setEmail(''); setTempPass('');
      fetchProfessors();
    } else {
      const data = await res.json();
      setError(data.error);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este professor?")) return;
    const res = await fetch(`/api/admin/professor/${id}`, { method: 'DELETE' });
    if (res.ok) fetchProfessors();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-indigo-100 shadow-lg">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">Admin Cemil</span>
          </div>
          <nav className="space-y-1">
            <NavItem icon={<Users className="w-4 h-4" />} label="Gestão de Professores" active />
            <NavItem icon={<FileText className="w-4 h-4" />} label="Voltar ao Editor" onClick={onBack} />
          </nav>
        </div>
        <div className="p-6 mt-auto border-t border-slate-100">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-10">
          <header className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestão de Professores</h1>
              <p className="text-slate-400">Adicione e gira as contas dos professores da instituição</p>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                <h2 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" /> Novo Professor
                </h2>
                <form onSubmit={handleAdd} className="space-y-4">
                  {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nome Completo</label>
                    <input value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none focus:bg-white border border-transparent focus:border-indigo-100" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">E-mail</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none focus:bg-white border border-transparent focus:border-indigo-100" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Senha Temporária</label>
                    <input value={tempPass} onChange={e => setTempPass(e.target.value)} required className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none focus:bg-white border border-transparent focus:border-indigo-100" />
                  </div>
                  <button disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-100 mt-4 disabled:opacity-50">
                    {loading ? "A processar..." : "Registar Professor"}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {professors.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-slate-400 text-sm italic">Nenhum professor cadastrado.</td>
                      </tr>
                    ) : professors.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700 text-sm">{p.name}</td>
                        <td className="px-6 py-4 text-slate-500 text-sm">{p.email}</td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDelete(p.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PasswordResetScreen({ onComplete }: { onComplete: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) return setError("As senhas não coincidem");
    setLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });
    if (res.ok) onComplete();
    else setError("Erro ao redefinir senha");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-xl p-10 border border-slate-100">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="bg-amber-100 p-4 rounded-2xl mb-4">
            <Key className="text-amber-600 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Primeiro Acesso</h1>
          <p className="text-slate-400 text-sm">Por segurança, defina uma nova palavra-passe pessoal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="text-xs text-red-500 bg-red-50 p-3 rounded-xl">{error}</p>}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nova Palavra-passe</label>
            <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-slate-50 rounded-2xl p-4 outline-none focus:bg-white border border-transparent focus:border-indigo-100" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmar Palavra-passe</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full bg-slate-50 rounded-2xl p-4 outline-none focus:bg-white border border-transparent focus:border-indigo-100" />
          </div>
          <button disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100">
            {loading ? "A guardar..." : "Atualizar e Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- SHARED COMPONENTS ---

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
      active ? 'bg-indigo-600 text-white shadow-indigo-100 shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
    }`}>
      {icon}
      {label}
    </button>
  );
}

function BlockAction({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-md transition-all text-left group active:scale-95"
    >
      <div className="flex items-center gap-3">
        <span className="text-slate-400 group-hover:text-indigo-500 transition-colors bg-slate-50 p-2 rounded-xl">{icon}</span>
        <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{label}</span>
      </div>
      <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
    </button>
  );
}
