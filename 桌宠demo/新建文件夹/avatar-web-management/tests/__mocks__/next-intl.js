const React = require('react');
const identity = (key) => key;

function useTranslations() {
  return identity;
}

function useFormatter() {
  return {
    dateTime: (d) => String(d),
    number: (n) => String(n),
  };
}

function NextIntlClientProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

module.exports = {
  useTranslations,
  useFormatter,
  NextIntlClientProvider,
};
