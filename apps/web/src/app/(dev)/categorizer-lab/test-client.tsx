'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function TestClient() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    console.log('🔥 TEST: Client-side hydration successful!');
    setIsHydrated(true);
  }, []);

  const handleClick = () => {
    console.log('🔥 TEST: Button clicked!');
    setClickCount(prev => prev + 1);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Hydration Test</h1>
      
      <div className="space-y-4">
        <div className={`p-4 rounded ${isHydrated ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          <strong>Hydration Status:</strong> {isHydrated ? '✅ Hydrated' : '⏳ Server-side render only'}
        </div>
        
        <div className="p-4 bg-blue-100 text-blue-800 rounded">
          <strong>Click Count:</strong> {clickCount}
        </div>
        
        <Button onClick={handleClick} className="w-full">
          Click Me to Test Hydration (Count: {clickCount})
        </Button>
        
        <div className="text-sm text-gray-600">
          <p><strong>Instructions:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>If hydration is working, you should see "✅ Hydrated" above</li>
            <li>The button should respond to clicks and increment the counter</li>
            <li>Check browser console for hydration success message</li>
          </ul>
        </div>
      </div>
    </div>
  );
}