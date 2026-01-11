import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Authenticator } from '@aws-amplify/ui-react'
import { configureAmplify } from './aws-config'
import './index.css'
import App from './App.tsx'

// Amplify 설정
configureAmplify();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Authenticator.Provider>
        <App />
      </Authenticator.Provider>
    </BrowserRouter>
  </StrictMode>,
)
