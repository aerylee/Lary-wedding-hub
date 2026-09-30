// Creating and editing channels and categories.
import { useState } from 'react';
import { useCollab } from '@/lib/collab';
import type { ChatCategory, ChatChannel } from '@/lib/types';
import { Button, Field, Input, Modal, Select } from '@/components/kit';
import { slugify } from './shared';

export function ChannelEditor({ channel, categories, onClose, onSaved }: { channel: Partial<ChatChannel>; categories: ChatCategory[]; onClose: () => void; onSaved: (c: ChatChannel) => void }) {
  const { saveChannel, channels } = useCollab();
  const [name, setName] = useState(channel.name ?? '');
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [category, setCategory] = useState(channel.category_id ?? '');
  const [busy, setBusy] = useState(false);
  const slug = slugify(name);
  const taken = channels.some((c) => c.name === slug && c.id !== channel.id);
  const save = async () => {
    if (!slug || taken) return;
    setBusy(true);
    try {
      const siblings = channels.filter((c) => (c.category_id ?? '') === category && !c.archived_at);
      const saved = await saveChannel({
        ...(channel.id ? { id: channel.id } : { position: siblings.length }),
        name: slug,
        topic: topic.trim(),
        category_id: category || null,
      });
      if (saved && !channel.id) onSaved(saved);
      onClose();
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={channel.id ? `Edit #${channel.name}` : 'New channel'}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || !slug || taken}>{channel.id ? 'Save' : 'Create channel'}</Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name" hint={taken ? 'There is already a channel with that name.' : slug && slug !== name ? `Will be #${slug}` : 'Lowercase, no spaces — like #flowers or #hen-weekend.'}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="flowers" maxLength={60} autoFocus />
        </Field>
        <Field label="Topic" hint="Optional: what this channel is for.">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Florist quotes, colours and the ceremony arch" maxLength={250} />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">No category</option>
            {[...categories].sort((a, b) => a.position - b.position).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

export function CategoryEditor({ category, onClose }: { category: Partial<ChatCategory>; onClose: () => void }) {
  const { saveCategory, categories } = useCollab();
  const [name, setName] = useState(category.name ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await saveCategory({ ...(category.id ? { id: category.id } : { position: categories.length }), name: name.trim() });
      onClose();
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={category.id ? 'Rename category' : 'New category'}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>{category.id ? 'Save' : 'Create category'}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name" hint="Categories group channels in the sidebar, like “Suppliers” or “Family”.">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus placeholder="Suppliers" />
        </Field>
      </form>
    </Modal>
  );
}

