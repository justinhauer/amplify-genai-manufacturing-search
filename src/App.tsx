import React, { useState } from 'react';
import './App.css';
import SearchBar from './components/SearchBar';
import ChatDisplay from './components/ChatDisplay';
import Uploader from './components/Uploader';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import { generateClient } from "aws-amplify/api";
import { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);

const client = generateClient<Schema>();

const App: React.FC = () => {
  const [messages, setMessages] = useState<{ user: string; text: string }[]>([]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setMessages((prevMessages) => [...prevMessages, { user: 'bot', text: 'Query cannot be empty.' }]);
      return;
    }

    try {
      const { data, errors } = await client.queries.generateHaiku({ prompt: query });

      if (errors) {
        throw new Error(`Error from Bedrock: ${errors[0].message}`);
      }

      setMessages((prevMessages) => [...prevMessages, { user: 'bot', text: data || "No response from AI" }]);
    } catch (error) {
      let errorMessage = 'Error fetching data.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setMessages((prevMessages) => [...prevMessages, { user: 'bot', text: `Error fetching data: ${errorMessage}` }]);
    }
  };

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div className="app-container">
          <div className="header">
            <div></div>
            <button className="signout-button" onClick={signOut}>Sign out</button>
          </div>
          <div className="uploader">
            <Uploader />
          </div>
          <div className="chat-search-container">
            <h1>Insurance Enrollment Search</h1>
            <SearchBar onSearch={handleSearch} />
            <ChatDisplay messages={messages} />
          </div>
        </div>
      )}
    </Authenticator>
  );
};

export default App;
