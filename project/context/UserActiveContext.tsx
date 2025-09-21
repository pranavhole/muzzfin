// context/AppContext.js
import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';

type UserActiveContextType = {
  user: any;
  setUser: Dispatch<SetStateAction<any>>;
};

const UserActiveContext = createContext<UserActiveContextType | undefined>(undefined);

export const useUserActiveContext = () => {
  const context = useContext(UserActiveContext);
  if (context === undefined) {
    throw new Error('useUserActiveContext must be used within a UserActiveProvider');
  }
  return context;
};

export function UserActiveProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  return (
    <UserActiveContext.Provider value={{ user, setUser }}>
      {children}
    </UserActiveContext.Provider>
  );
}
