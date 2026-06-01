// Mock uuid/v4 for Jest tests — avoids ESM transform issues with uuid v14+
let counter = 0;
module.exports = {
  v4: () => {
    counter++;
    return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  },
  v1: () => `00000000-0000-1000-8000-${String(++counter).padStart(12, '0')}`,
  default: {
    v4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  },
};
