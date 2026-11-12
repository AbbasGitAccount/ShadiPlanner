import { randomUUID } from 'node:crypto';
import { Router, Response } from 'express';
import { db } from '../data/db.js';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { WeddingChecklistItem, WeddingBudgetItem } from '../models/types.js';

const router = Router();

// --- Vendors ---
router.get('/vendors', (_req, res) => {
  const { category, city } = _req.query as { category?: string; city?: string };
  let vendors = db.vendors;

  if (category && category !== 'all') {
    vendors = vendors.filter((v) => v.category.toLowerCase() === category.toLowerCase());
  }

  if (city && city !== 'all') {
    vendors = vendors.filter((v) => v.city.toLowerCase().includes(city.toLowerCase()));
  }

  res.json(vendors);
});

// Private planning records are always scoped to the authenticated account.
router.use(authenticateToken, (_req, res, next) => { res.set('Cache-Control','no-store'); next(); });
router.use((req, res, next) => {
  if (!['POST','PUT'].includes(req.method)) { next(); return; }
  const data=req.body || {};
  for(const key of ['title','category','notes']) if(data[key]!==undefined && (typeof data[key]!=='string' || data[key].length>(key==='notes'?2000:200) || key!=='notes'&&!data[key].trim())) { res.status(400).json({message:'Enter valid task or budget details.'}); return; }
  for(const key of ['estimatedCost','allocatedAmount','actualAmount']) if(data[key]!==undefined) {
    const raw=data[key];const value=Number(raw);
    if(!['string','number'].includes(typeof raw)||String(raw).trim()===''||!Number.isFinite(value)||value<0||value>1000000000) {res.status(400).json({message:'Amounts must be between 0 and 1,000,000,000 rupees.'});return;}
  }
  if(data.completed!==undefined && typeof data.completed!=='boolean'){res.status(400).json({message:'Completion must be true or false.'});return;}
  if(data.dueDate!==undefined && (typeof data.dueDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)||!Number.isFinite(Date.parse(data.dueDate))||new Date(data.dueDate).toISOString().slice(0,10)!==data.dueDate)){res.status(400).json({message:'Enter a valid due date as YYYY-MM-DD.'});return;}
  next();
});
// --- Checklist ---
router.get('/checklist', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const items = db.checklist.filter((c) => c.userId === userId);
  res.json(items);
});

router.post('/checklist', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { title, category, dueDate, estimatedCost } = req.body;

  if (!title) {
    res.status(400).json({ message: 'Title is required' });
    return;
  }

  const newItem: WeddingChecklistItem = {
    id: `check_${randomUUID()}`,
    userId,
    title,
    category: category || 'Ceremony & Rituals',
    dueDate: dueDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    completed: false,
    estimatedCost: Number(estimatedCost) || 0,
  };

  db.checklist.push(newItem);
  db.save();
  res.status(201).json(newItem);
});

router.put('/checklist/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const item = db.checklist.find((c) => c.id === id && c.userId === req.user!.id);

  if (!item) {
    res.status(404).json({ message: 'Checklist item not found' });
    return;
  }

  if (req.body.completed !== undefined) {
    item.completed = req.body.completed;
  }
  if (req.body.title) {
    item.title = req.body.title;
  }
  if (req.body.estimatedCost !== undefined) {
    item.estimatedCost = Number(req.body.estimatedCost);
  }

  db.save();
  res.json(item);
});

router.delete('/checklist/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const index = db.checklist.findIndex((c) => c.id === id && c.userId === req.user!.id);

  if (index === -1) {
    res.status(404).json({ message: 'Item not found' });
    return;
  }

  db.checklist.splice(index, 1);
  db.save();
  res.json({ message: 'Item deleted' });
});

// --- Budget Planner ---
router.get('/budget', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const items = db.budget.filter((b) => b.userId === userId);
  res.json(items);
});

router.post('/budget', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { category, allocatedAmount, actualAmount, notes } = req.body;

  if (!category || allocatedAmount === undefined) {
    res.status(400).json({ message: 'Category and allocated amount are required' });
    return;
  }

  const newItem: WeddingBudgetItem = {
    id: `budget_${randomUUID()}`,
    userId,
    category,
    allocatedAmount: Number(allocatedAmount) || 0,
    actualAmount: Number(actualAmount) || 0,
    notes: notes || '',
  };

  db.budget.push(newItem);
  db.save();
  res.status(201).json(newItem);
});

router.put('/budget/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const item = db.budget.find((b) => b.id === id && b.userId === req.user!.id);

  if (!item) {
    res.status(404).json({ message: 'Budget item not found' });
    return;
  }

  if (req.body.allocatedAmount !== undefined) item.allocatedAmount = Number(req.body.allocatedAmount);
  if (req.body.actualAmount !== undefined) item.actualAmount = Number(req.body.actualAmount);
  if (req.body.notes !== undefined) item.notes = req.body.notes;

  db.save();
  res.json(item);
});

router.delete('/budget/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const index = db.budget.findIndex((b) => b.id === id && b.userId === req.user!.id);

  if (index === -1) {
    res.status(404).json({ message: 'Budget item not found' });
    return;
  }

  db.budget.splice(index, 1);
  db.save();
  res.json({ message: 'Budget category removed' });
});

export default router;

