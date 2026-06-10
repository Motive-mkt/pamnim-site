import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles, ArrowRight, Hourglass } from 'lucide-react';
import { useCMS } from '../hooks/useCMS';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export default function PortfolioAssistant() {
  const { content } = useCMS();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: 'Good day. Welcome to Pamnim Interiors showroom. I am your dedicated AI Portfolio Assistant. How may I assist you with your space today?',
      timestamp: new Date(),
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const whatsappNumber = content?.contact?.whatsapp || '254714984268';
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Hello Pamnim Interiors! I am visiting your portfolio and would like to chat about a design project."
  )}`;

  // Automatically scroll to the end of message list on new stream entries
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating, isOpen]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isGenerating) return;

    const userMsg: Message = {
      role: 'user',
      text: textToSend.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setUserInput('');
    setIsGenerating(true);

    try {
      // Map existing messages to strict API history structure
      const history = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const response = await fetch('/api/portfolio-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMsg.text,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error('Our communication channel encountered a brief network latency.');
      }

      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: data.text || 'Thank you for your response. To refine our planning, may we transition to a direct conversation with our lead designer on WhatsApp?',
          timestamp: new Date(),
        },
      ]);
    } catch (error: any) {
      console.error('Chat Assistant Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: 'We are experiencing elevated gallery interest. Let us capture your requirements directly on WhatsApp so our design team can contact you.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestionClick = (suggestionText: string) => {
    handleSendMessage(suggestionText);
  };

  const suggestions = [
    "Tell me about your residential design services",
    "How can I book a design consultation?",
    "Where is the studio's project portfolio?",
    "What are your general pricing guidelines?"
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans" id="portfolio-assistant-container">
      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-5 py-4 bg-[#0D4428] text-[#FAFAF8] rounded-full shadow-2xl hover:bg-[#09301C] transition-colors duration-300 border border-[#165a36]/40 cursor-pointer"
        id="assistant-toggle-button"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
        </span>
        <MessageSquare className="w-5 h-5 text-[#FAFAF8]" />
        <span className="text-sm font-medium tracking-wide">Pamnim Assistant</span>
      </motion.button>

      {/* Main Conversational Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute bottom-20 right-0 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] bg-[#FAFAF8] border border-[#E5E5DF] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            id="assistant-viewport-card"
          >
            {/* Header */}
            <div className="p-4 bg-[#0D4428] border-b border-[#0D4428] flex items-center justify-between text-[#FAFAF8]" id="assistant-header-banner">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#185A34] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#FAFAF8]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wide">Pamnim Assistant</h3>
                  <p className="text-[10px] text-emerald-300 tracking-wider uppercase font-mono">Luxury AI Curated</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 px-2 rounded-lg hover:bg-[#185A34] hover:text-[#FAFAF8] transition-all cursor-pointer"
                id="assistant-close-button"
              >
                <X className="w-5 h-5 text-[#FAFAF8]" />
              </button>
            </div>

            {/* Premium Sticky Call-to-Action to WhatsApp conversion */}
            <div className="bg-[#FAF7E6] p-3 text-xs border-b border-[#E5E5DF] flex items-center justify-between gap-3" id="assistant-sticky-cta">
              <span className="text-[#3B3929] leading-snug font-medium">
                Want direct consultation, booking or specialized pricing?
              </span>
              <a
                href={whatsappUrl}
                target="_blank"
                referrerPolicy="no-referrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D4428] text-[#FAFAF8] rounded-full text-[11px] font-semibold hover:bg-[#09301C] transition-colors whitespace-nowrap whitespace-no-wrap select-none"
                id="assistant-whatsapp-conversion-link"
              >
                Let's WhatsApp
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" id="assistant-chat-history">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  id={`chat-message-${idx}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#EAEAE2] text-[#1E1E1C] rounded-tr-none'
                        : 'bg-[#292927] text-[#FAFAF8] rounded-tl-none font-light'
                    }`}
                  >
                    <span>{msg.text}</span>
                    <span className="block text-[8px] mt-1 text-right tracking-wider opacity-60 font-mono">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {/* Generating Loader */}
              {isGenerating && (
                <div className="flex justify-start" id="assistant-loader-container">
                  <div className="bg-[#292927] text-[#FAFAF8] rounded-2xl rounded-tl-none p-3 max-w-[85%] shadow-sm text-xs flex items-center gap-2">
                    <Hourglass className="w-3.5 h-3.5 animate-spin text-[#FAFAF8]" />
                    <span className="italic tracking-wider font-light">Curating Spatial Details...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Chips */}
            {messages.length === 1 && !isGenerating && (
              <div className="px-4 pb-3 space-y-1.5" id="assistant-quick-prompts">
                <p className="text-[10px] text-gray-400 uppercase font-mono tracking-wider font-bold">Suggested questions:</p>
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="text-left w-full px-3 py-2 bg-[#FAFAF8] hover:bg-[#F0F0EA] active:bg-[#EAEAE2] border border-[#E5E5DF] text-[#484844] rounded-xl text-xs transition-colors duration-200 truncate cursor-pointer font-medium"
                      id={`suggestion-chip-${index}`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(userInput);
              }}
              className="p-3 bg-[#FAFAF8] border-t border-[#E5E5DF] flex items-center gap-2"
              id="assistant-bottom-composer"
            >
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Ask about materials, services, spatial plan..."
                disabled={isGenerating}
                className="flex-1 bg-[#F0F0EA] border border-[#E5E5DF] rounded-xl px-3 py-2.5 text-xs text-[#1E1E1C] placeholder-[#80807C] focus:outline-none focus:ring-1 focus:ring-[#0D4428] focus:bg-[#FAFAF8] transition-all"
                id="assistant-user-input-field"
              />
              <button
                type="submit"
                disabled={!userInput.trim() || isGenerating}
                className="p-2.5 bg-[#0D4428] hover:bg-[#09301C] disabled:bg-gray-200 text-[#FAFAF8] disabled:text-gray-400 rounded-xl transition-colors cursor-pointer"
                id="assistant-submit-button"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Footer Tagline */}
            <div className="bg-[#F0F0EA] text-center py-1.5 px-3 text-[9px] text-[#A0A09C]" id="assistant-badge-footnote">
              Curated by Pamnim Interiors Studio &bull; Live Support on WhatsApp
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
