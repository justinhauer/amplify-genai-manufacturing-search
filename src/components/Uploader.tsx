import React from 'react';
import { StorageManager } from '@aws-amplify/ui-react-storage';
import '@aws-amplify/ui-react/styles.css';

const Uploader: React.FC = () => {
    return (
        <div className="uploader">
            <StorageManager
                acceptedFileTypes={['.csv']}
                path="public/"
                maxFileCount={10}
                isResumable
            />
        </div>
    );
};

export default Uploader;