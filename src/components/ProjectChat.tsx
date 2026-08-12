import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Send, Tag, MessageSquare, User, Building, Clock, Paperclip } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderRole: string;
  text: string;
  taggedContext?: string;
  createdAt: string;
}

interface ProjectChatProps {
  clientId: string;
  clientName: string;
  initialTaggedContext?: string;
  onClearTag?: () => void;
}

export default function ProjectChat({
  clientId,
  clientName,
  initialTaggedContext,
  onClearTag
}: ProjectChatProps) {
  const { profile, isStaff } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [taggedContext, setTaggedContext] = useState<string | undefined>(initialTaggedContext);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTaggedContext) {
      setTaggedContext(initialTaggedContext);
    }
  }, [initialTaggedContext]);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);

    const messagesRef = collection(db, 'chats', clientId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(list);
      setLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (err) => {
      console.error('Error listening to chat messages:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clientId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !clientId || !profile) return;

    const messageText = text.trim();
    const currentTag = taggedContext;

    setText('');
    setTaggedContext(undefined);
    if (onClearTag) onClearTag();

    try {
      const messagesRef = collection(db, 'chats', clientId, 'messages');
      await addDoc(messagesRef, {
        senderUid: profile.uid,
        senderName: profile.name || 'User',
        senderRole: profile.role || 'client',
        text: messageText,
        taggedContext: currentTag || null,
        createdAt: new Date().toISOString()
      });

      // Update parent chat summary metadata
      await setDoc(doc(db, 'chats', clientId), {
        clientId,
        clientName,
        lastMessage: messageText,
        lastUpdated: new Date().toISOString(),
        updatedBy: profile.name
      }, { merge: true });

    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message.');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-charcoal/10 shadow-sm flex flex-col h-[600px] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-charcoal/10 bg-cream/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-charcoal text-base">
              {isStaff ? `Chat with ${clientName}` : 'Pamnim Interiors Support Thread'}
            </h3>
            <p className="text-xs text-charcoal/50">Direct ongoing conversation</p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/50">
        {loading ? (
          <div className="text-center py-12 text-charcoal/40 animate-pulse text-sm">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-charcoal/40 text-sm">
            No messages in thread yet. Start the conversation below!
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderUid === profile?.uid;
            const isStaffSender = msg.senderRole !== 'client';

            return (
              <div
                key={msg.id}
                className={cn("flex flex-col max-w-[80%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}
              >
                {/* Sender Name & Badge */}
                <div className="flex items-center gap-2 mb-1 text-[11px] text-charcoal/50 px-1">
                  <span className="font-semibold">{msg.senderName}</span>
                  {isStaffSender && (
                    <span className="bg-ochre/10 text-ochre text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      Team
                    </span>
                  )}
                  <span>• {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* Tagged Context Badge if message stems from stage comment */}
                {msg.taggedContext && (
                  <div className="mb-1 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-ochre shrink-0" />
                    <span>{msg.taggedContext}</span>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    "p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm",
                    isMe
                      ? "bg-ochre text-white rounded-tr-none"
                      : "bg-white text-charcoal border border-charcoal/10 rounded-tl-none"
                  )}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-charcoal/10 bg-white space-y-3">
        {taggedContext && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <Tag className="w-3.5 h-3.5 text-ochre shrink-0" />
              <span className="truncate">Tagging stage: {taggedContext}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTaggedContext(undefined);
                if (onClearTag) onClearTag();
              }}
              className="text-xs text-amber-800 font-bold hover:underline ml-2"
            >
              Clear
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type your message..."
            value={text}
            onChange={e => setText(e.target.value)}
            className="flex-1 px-4 py-3 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm bg-cream/30"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="w-12 h-12 rounded-2xl bg-ochre text-white flex items-center justify-center shadow-md shadow-ochre/20 hover:bg-ochre-dark transition-all disabled:opacity-40 shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
