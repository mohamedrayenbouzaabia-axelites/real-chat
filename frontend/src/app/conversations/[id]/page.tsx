'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';

interface User {
  userId: string;
  username: string;
  publicId: string;
}

interface Conversation {
  id: string;
  is_direct: boolean;
  name: string | null;
  created_at: string;
  updated_at: string;
  other_user_id: string;
  other_username: string;
  other_public_id: string;
}

interface Message {
  id: string;
  sender_id: string;
  encrypted_content: any;
  message_type: string;
  reply_to_id?: string;
  reply_to_content?: any;
  reply_to_sender_id?: string;
  reactions?: Array<{ emoji: string; user_id: string }>;
  created_at: string;
}

function ConversationsPageInner() {
  const router = useRouter();
  const params = useParams();
  const { user: authUser, token, getAuthHeader } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConversationRef = useRef<Conversation | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [publicIdInput, setPublicIdInput] = useState('');
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<Message | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(350); // Default sidebar width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [userPublicId, setUserPublicId] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  // Derive user from authUser
  const user: User | null = authUser ? {
    userId: authUser.userId,
    username: authUser.username,
    publicId: userPublicId || 'Loading...',
  } : null;

  useEffect(() => {
    if (!authUser || !token) {
      setLoading(false);
      return;
    }

    // Fetch user's public ID
    const fetchPublicId = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.user?.publicId) {
            setUserPublicId(data.user.publicId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch public ID:', err);
      }
    };

    fetchPublicId();

    try {
      fetchConversations();
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [authUser, token]);

  // Load conversation when ID is in URL, or auto-select first conversation
  useEffect(() => {
    if (conversations.length === 0) return;

    if (params.id) {
      // Load the conversation from URL
      const conv = conversations.find(c => c.id === params.id);
      if (conv) {
        setSelectedConversation(conv);
        selectedConversationRef.current = conv;
        fetchMessages(params.id);
      }
    } else if (!selectedConversation && conversations.length > 0) {
      // Auto-select first conversation if no ID in URL and nothing selected
      const firstConv = conversations[0];
      setSelectedConversation(firstConv);
      selectedConversationRef.current = firstConv;
      fetchMessages(firstConv.id);
      // Update URL without reload
      router.replace(`/conversations/${firstConv.id}`, { scroll: false });
    }
  }, [params.id, conversations]);

  // WebSocket connection for real-time updates (connect only once)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use global WebSocket reference to persist across Next.js navigations
    if (!(window as any).globalWebSocket) {
      if (!token) {
        console.error('❌ No access token found');
        return;
      }

      console.log('🔌 Creating global WebSocket connection...');

      // Connect to WebSocket
      const wsUrl = `ws://localhost:3001/ws?token=${token}`;
      console.log('WebSocket URL:', wsUrl);
      const ws = new WebSocket(wsUrl);

      // Store in global scope
      (window as any).globalWebSocket = ws;
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('🔔 WebSocket message received:', data.type, data);

          switch (data.type) {
            case 'new_message':
              console.log('📨 New message received for conversation:', data.payload.conversationId);
              console.log('Current conversation (from ref):', selectedConversationRef.current?.id);
              // Add new message to the list if we're viewing that conversation
              if (selectedConversationRef.current?.id === data.payload.conversationId) {
                console.log('✅ Adding message to UI:', data.payload.message);
                setMessages((prev) => {
                  // Avoid duplicates
                  if (prev.some(m => m.id === data.payload.message.id)) {
                    console.log('⚠️ Duplicate message prevented');
                    return prev;
                  }
                  console.log('➕ Message added to state');
                  return [...prev, data.payload.message];
                });
              } else {
                console.log('❌ Message not for current conversation, ignoring');
              }
              break;

            case 'new_reaction':
              console.log('😀 New reaction received for message:', data.payload.messageId);
              // Update reactions for a message
              if (selectedConversationRef.current?.id === data.payload.conversationId) {
                console.log('✅ Updating reaction in UI');
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id === data.payload.messageId) {
                      const reaction = data.payload.reaction;
                      let reactions = msg.reactions ? [...msg.reactions] : [];

                      if (reaction.action === 'added') {
                        // Check if reaction already exists
                        if (!reactions.some(r => r.emoji === reaction.emoji && r.user_id === reaction.userId)) {
                          reactions.push({ emoji: reaction.emoji, user_id: reaction.userId });
                        }
                      } else if (reaction.action === 'removed') {
                        reactions = reactions.filter(
                          r => !(r.emoji === reaction.emoji && r.user_id === reaction.userId)
                        );
                      }

                      return { ...msg, reactions };
                    }
                    return msg;
                  })
                );
              }
              break;

            case 'presence':
              console.log('👤 Presence update:', data.payload);
              break;

            case 'typing':
              console.log('⌨️ Typing indicator:', data.payload);
              break;

            default:
              console.log('❓ Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        (window as any).globalWebSocket = null;
        wsRef.current = null;

        // Auto-reconnect if it wasn't intentionally closed
        if (event.code !== 1000) {
          console.log('🔄 Attempting to reconnect in 3 seconds...');
          setTimeout(() => {
            if (typeof window !== 'undefined' && !(window as any).globalWebSocket) {
              console.log('🔄 Reconnecting...');
              if (token) {
                const newWs = new WebSocket(`ws://localhost:3001/ws?token=${token}`);
                (window as any).globalWebSocket = newWs;
                wsRef.current = newWs;
                // Re-attach all event handlers...
                newWs.onopen = ws.onopen;
                newWs.onmessage = ws.onmessage;
                newWs.onerror = ws.onerror;
                newWs.onclose = ws.onclose;
              }
            }
          }, 3000);
        }
      };
    } else {
      // Reuse existing global WebSocket
      console.log('♻️ Reusing existing global WebSocket');
      wsRef.current = (window as any).globalWebSocket;

      // Re-attach message handler with current selectedConversation
      if (wsRef.current) {
        wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('🔔 WebSocket message received:', data.type, data);

          switch (data.type) {
            case 'new_message':
              console.log('📨 New message received for conversation:', data.payload.conversationId);
              console.log('Current conversation (from ref):', selectedConversationRef.current?.id);
              // Add new message to the list if we're viewing that conversation
              if (selectedConversationRef.current?.id === data.payload.conversationId) {
                console.log('✅ Adding message to UI:', data.payload.message);
                setMessages((prev) => {
                  // Avoid duplicates
                  if (prev.some(m => m.id === data.payload.message.id)) {
                    console.log('⚠️ Duplicate message prevented');
                    return prev;
                  }
                  console.log('➕ Message added to state');
                  return [...prev, data.payload.message];
                });
              } else {
                console.log('❌ Message not for current conversation, ignoring');
              }
              break;

            case 'new_reaction':
              console.log('😀 New reaction received for message:', data.payload.messageId);
              // Update reactions for a message
              if (selectedConversationRef.current?.id === data.payload.conversationId) {
                console.log('✅ Updating reaction in UI');
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id === data.payload.messageId) {
                      const reaction = data.payload.reaction;
                      let reactions = msg.reactions ? [...msg.reactions] : [];

                      if (reaction.action === 'added') {
                        // Check if reaction already exists
                        if (!reactions.some(r => r.emoji === reaction.emoji && r.user_id === reaction.userId)) {
                          reactions.push({ emoji: reaction.emoji, user_id: reaction.userId });
                        }
                      } else if (reaction.action === 'removed') {
                        reactions = reactions.filter(
                          r => !(r.emoji === reaction.emoji && r.user_id === reaction.userId)
                        );
                      }

                      return { ...msg, reactions };
                    }
                    return msg;
                  })
                );
              }
              break;

            case 'presence':
              console.log('👤 Presence update:', data.payload);
              break;

            case 'typing':
              console.log('⌨️ Typing indicator:', data.payload);
              break;

            default:
              console.log('❓ Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };
      }
    }

    // No cleanup - we want the WebSocket to persist
    return () => {
      // Don't close the WebSocket, just clear the ref
      wsRef.current = null;
    };
  }, []); // Empty dependency array - connect only once

  // Subscribe to conversation when it changes or when WebSocket connects
  useEffect(() => {
    if (!selectedConversation) return;

    const subscribe = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const subscribeMessage = {
          type: 'subscribe',
          payload: {
            conversationId: selectedConversation.id,
          },
          timestamp: Date.now(),
        };
        console.log('Subscribing to conversation:', selectedConversation.id, subscribeMessage);
        wsRef.current.send(JSON.stringify(subscribeMessage));
      } else {
        console.log('WebSocket not ready, retrying in 100ms...');
        setTimeout(subscribe, 100);
      }
    };

    subscribe();
  }, [selectedConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/conversations', {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/conversations/${conversationId}/messages`, {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    selectedConversationRef.current = conversation;
    router.push(`/conversations/${conversation.id}`);
    fetchMessages(conversation.id);
  };

  const handleStartConversation = async () => {
    setError(null);
    setSuccess(null);

    if (!publicIdInput.trim()) {
      setError('Please enter a public ID');
      return;
    }

    setCreatingConversation(true);

    try {
      const response = await fetch('http://localhost:3001/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ identifier: publicIdInput.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Conversation created successfully!');
        setPublicIdInput('');
        fetchConversations();
        setTimeout(() => {
          setShowNewChatModal(false);
          setSuccess(null);
        }, 1500);
      } else {
        setError(data.message || 'Failed to create conversation');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:3001/api/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          content: newMessage,
          messageType: 'text',
          replyToId: replyingTo?.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setNewMessage('');
        setReplyingTo(null);
        // Don't fetch messages - WebSocket will handle the update
      } else {
        setError(data.message || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setSending(false);
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    // Focus on input
    document.getElementById('message-input')?.focus();
  };

  const handleReact = async (message: Message, emoji: string) => {
    if (!selectedConversation) return;

    try {
      await fetch(`http://localhost:3001/api/conversations/${selectedConversation.id}/messages/${message.id}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ emoji }),
      });

      // Don't fetch messages - WebSocket will handle the update
      setShowEmojiPicker(false);
      setSelectedMessageForReaction(null);
    } catch (err) {
      setError('Failed to react to message');
    }
  };

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👏', '🙏'];

  // Sidebar resize handlers
  const MIN_SIDEBAR_WIDTH = 250;
  const MAX_SIDEBAR_WIDTH = 600;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const handleLogout = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100 dark:bg-gray-900">
      {/* Left Sidebar - Contacts */}
      <div
        className="hidden md:flex bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col relative z-10 flex-shrink-0"
        style={{
          width: `${sidebarWidth}px`,
          minWidth: `${MIN_SIDEBAR_WIDTH}px`,
          maxWidth: `${MAX_SIDEBAR_WIDTH}px`,
          boxShadow: '1px 0 8px rgba(0,0,0,0.15)'
        }}
      >
        {/* Sidebar Header */}
        <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-gray-600 dark:text-gray-300 font-semibold">
                {user?.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{user?.username}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{user?.publicId}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* User Avatar with Plus */}
            <button
              onClick={() => setShowNewChatModal(true)}
              className="relative p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
              title="New Chat"
            >
              <div className="w-6 h-6 bg-gray-300 dark:bg-gray-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              {/* Plus Badge */}
              <div className="absolute -bottom-0 -right-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-700">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
              title="Logout"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-white dark:bg-gray-800">
          <div className="relative">
            <input
              type="text"
              placeholder="Search or start new chat"
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white text-sm"
            />
            <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
              <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-center text-sm">No conversations yet.</p>
              <p className="text-center text-sm mt-2">Click the + button to start chatting!</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                className={`flex items-center px-4 py-3 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 ${
                  selectedConversation?.id === conversation.id
                    ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                  <span className="text-green-600 dark:text-green-400 font-semibold text-lg">
                    {conversation.other_username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {conversation.other_username}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                      {new Date(conversation.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">
                    {conversation.other_public_id}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className="hidden md:block w-1 bg-transparent hover:bg-blue-500 cursor-col-resize transition-colors relative z-20 flex-shrink-0"
        onMouseDown={handleMouseDown}
        style={{ cursor: isResizing ? 'col-resize' : 'col-resize' }}
      >
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded ${isResizing ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
      </div>

      {/* Right Side - Chat Container */}
      {selectedConversation ? (
        <div className="hidden md:flex flex-1 flex-col bg-gray-100 dark:bg-gray-900">
          {/* Chat Navbar */}
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <span className="text-green-600 dark:text-green-400 font-semibold text-lg">
                  {selectedConversation.other_username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-white">
                  {selectedConversation.other_username}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {selectedConversation.other_public_id}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{
              backgroundColor: '#efe7dd',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23eae0d5' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
          >
            <div className="max-w-4xl mx-auto space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
                  {/* Avatar */}
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-green-600 dark:text-green-400 font-semibold text-3xl">
                      {selectedConversation.other_username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* Username */}
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">
                    {selectedConversation.other_username}
                  </h3>
                  <p className="text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                    const isOwn = message.sender_id === user?.userId;
                    const hasReactions = message.reactions && message.reactions.length > 0;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group relative`}
                      >
                        <div className={`max-w-[70%] ${hasReactions ? 'mb-1' : ''}`}>
                          <div
                            className={`rounded-lg px-3 py-2 relative ${
                              isOwn
                                ? 'text-black rounded-br-none'
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none'
                            }`}
                            style={isOwn ? { backgroundColor: '#d9fdd3', boxShadow: '0 1.5px 0.5px rgba(11,20,26,.13)' } : { boxShadow: '0 1px 0.5px rgba(11,20,26,.13)' }}
                          >
                            {/* Reply Preview */}
                            {message.reply_to_content && (
                              <div className={`mb-2 pb-2 border-l-2 bg-gray-400 dark:bg-gray-700 rounded-[10px] bg-opacity-20 ${
                                isOwn ? 'border-green-400' : 'border-gray-400'
                              } pl-2 opacity-80`}>
                                <div className="text-xs opacity-70 mb-1">
                                  {message.reply_to_sender_id === user?.userId ? 'You' : selectedConversation?.other_username}
                                </div>
                                <div className="text-xs truncate opacity-90">
                                  {message.reply_to_content?.ciphertext || '(No content)'}
                                </div>
                              </div>
                            )}

                            <div className="flex items-end justify-end gap-1">
                              <p className="text-sm whitespace-pre-wrap break-words flex-1">
                                {message.message_type === 'text'
                                  ? (message.encrypted_content?.ciphertext || '(No content)')
                                  : 'Unsupported message type'}
                              </p>
                              <sub className="text-xs text-gray-600 self-end pb-0.5">
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isOwn && (
                                  <svg className="w-3 h-3 inline ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </sub>
                            </div>
                          </div>

                          {/* Reactions */}
                          {hasReactions && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              {(() => {
                                // Group reactions by emoji and count them
                                const reactionGroups = message.reactions!.reduce((acc, reaction) => {
                                  if (!acc[reaction.emoji]) {
                                    acc[reaction.emoji] = {
                                      emoji: reaction.emoji,
                                      count: 0,
                                      users: [],
                                    };
                                  }
                                  acc[reaction.emoji].count++;
                                  acc[reaction.emoji].users.push(reaction.user_id);
                                  return acc;
                                }, {} as Record<string, { emoji: string; count: number; users: string[] }>);

                                const groupedReactions = Object.values(reactionGroups);
                                const MAX_VISIBLE = 5;

                                // Show reactions up to MAX_VISIBLE
                                const visibleReactions = groupedReactions.slice(0, MAX_VISIBLE);
                                const remainingCount = groupedReactions.length - MAX_VISIBLE;

                                return (
                                  <>
                                    {visibleReactions.map((group, idx) => (
                                      <span
                                        key={idx}
                                        className="text-sm bg-white dark:bg-gray-700 rounded-full px-2 py-0.5 shadow-sm border border-gray-200 dark:border-gray-600 flex items-center gap-1"
                                        title={group.count > 1 ? `${group.count} people reacted` : '1 person reacted'}
                                      >
                                        <span>{group.emoji}</span>
                                        {group.count > 1 && (
                                          <span className="text-xs text-gray-600 dark:text-gray-300">{group.count}</span>
                                        )}
                                      </span>
                                    ))}
                                    {remainingCount > 0 && (
                                      <span className="text-sm bg-gray-100 dark:bg-gray-600 rounded-full px-2 py-0.5 shadow-sm border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300">
                                        +{remainingCount} more
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          {/* Action Buttons (shown on hover) */}
                          <div className={`flex gap-2 mt-1 ${isOwn ? 'justify-end' : 'justify-start'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <button
                              onClick={() => handleReply(message)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Reply"
                            >
                              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedMessageForReaction(message);
                                setShowEmojiPicker(!showEmojiPicker && selectedMessageForReaction?.id === message.id);
                              }}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              title="React"
                            >
                              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          </div>

                          {/* Emoji Picker */}
                          {showEmojiPicker && selectedMessageForReaction?.id === message.id && (
                            <div className={`absolute bottom-full ${isOwn ? 'right-0' : 'left-0'} mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 z-50`}>
                              <div className="grid grid-cols-5 gap-1">
                                {commonEmojis.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReact(message, emoji)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-xl"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-4 pb-2">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              {/* Reply Indicator */}
              {replyingTo && (
                <div className="max-w-4xl mx-auto mb-2 bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-green-700 dark:text-green-400 font-semibold mb-1">
                        Replying to {replyingTo.sender_id === user?.userId ? 'yourself' : selectedConversation?.other_username}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {replyingTo.encrypted_content?.ciphertext || '(No content)'}
                      </div>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="ml-2 p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded transition-colors"
                    >
                      <svg className="w-5 h-5 text-green-700 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              <div className="max-w-4xl mx-auto flex items-center space-x-3">
                <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <div className="flex-1 relative">
                  <input
                    id="message-input"
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !sending && handleSendMessage()}
                    placeholder={replyingTo ? "Type your reply..." : "Type a message"}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white text-sm"
                    disabled={sending}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  hidden={sending || !newMessage.trim()}
                  className={`p-2.5 rounded-full transition-colors ${
                    sending || !newMessage.trim()
                      ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                      : 'hover:opacity-90'
                  }`}
                  style={(!sending && newMessage.trim()) ? { backgroundColor: 'rgb(22 163 74)' } : {}}
                >
                  {sending ? (
                    <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="50" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} style={{transform: 'rotate(90deg)',transformOrigin: '50% 50%' }} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* New Chat Modal */}
          {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Start New Chat
              </h3>
              {error && (
                <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-3 p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm rounded-lg">
                  {success}
                </div>
              )}
              <input
                type="text"
                value={publicIdInput}
                onChange={(e) => setPublicIdInput(e.target.value.toUpperCase())}
                placeholder="Enter public ID (e.g., ABCD-1234-EFGH-5678)"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-4"
                onKeyPress={(e) => e.key === 'Enter' && handleStartConversation()}
                disabled={creatingConversation}
                autoFocus
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowNewChatModal(false);
                    setError(null);
                    setSuccess(null);
                    setPublicIdInput('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={creatingConversation}
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartConversation}
                  disabled={creatingConversation}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {creatingConversation ? 'Creating...' : 'Start Chat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export wrapper with ProtectedRoute
export default function ConversationsPage() {
  return (
    <ProtectedRoute>
      <ConversationsPageInner />
    </ProtectedRoute>
  );
}
