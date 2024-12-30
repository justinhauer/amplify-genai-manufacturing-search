import React, { useEffect, useRef } from 'react';

interface ChatDisplayProps {
    messages: { user: string; text: string }[];
}

const ChatDisplay: React.FC<ChatDisplayProps> = ({ messages }) => {
    const chatDisplayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatDisplayRef.current) {
            chatDisplayRef.current.scrollTop = chatDisplayRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="chat-display" ref={chatDisplayRef}>
            {messages.map((message, index) => (
                <div key={index} className={`message ${message.user}`}>
                    {message.text}
                </div>
            ))}
        </div>
    );
};

export default ChatDisplay;
