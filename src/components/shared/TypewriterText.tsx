import { useState, useEffect } from 'react';

interface Props {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
  showCursor?: boolean;
}

export function TypewriterText({ text, delay = 0, speed = 40, className, showCursor = true }: Props) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) {
      setStarted(true);
      return;
    }
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    setDisplayed('');
    
    // Set first character immediately or start interval
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, [started, text, speed]);

  const isDone = displayed.length === text.length;

  return (
    <span className={className}>
      {displayed}
      {showCursor && (!isDone) && (
        <span className="inline-block w-2 h-4 bg-current ml-1 animate-cursor-blink" data-testid="terminal-cursor"></span>
      )}
    </span>
  );
}
