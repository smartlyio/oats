import React from 'react';
import './App.css';
import './fake-server';

function App() {
  const [data, setData] = React.useState("no data");
  return (
    <div className="App">
        <p>
          Test app.
        </p>
        <button onClick={async () => {
          const data = await fetch("/api/example");
          const json = await data.json();
          setData(JSON.stringify(json, null, 4));
        }}>GET</button>
      <div>
      <code>{data}</code>
      </div>
    </div>
  );
}

export default App;
