import React from 'react';

export const TelegramFrame: React.FC<{ children: React.ReactNode; isTmaView?: boolean; onToggleView?: (isTma: boolean) => void }> = ({ children }) => {
  return <>{children}</>;
};
