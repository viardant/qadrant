declare const process: {
  env: {
    TZ: string;
    [key: string]: string | undefined;
  };
};

process.env.TZ = 'UTC';
import '@testing-library/jest-dom';


