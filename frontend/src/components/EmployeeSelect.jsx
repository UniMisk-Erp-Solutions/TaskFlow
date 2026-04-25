import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';

export default function EmployeeSelect({ value, onChange, style }) {
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'employee')
      .then(({ data }) => setEmployees(data || []));
  }, []);

  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} style={style}>
      <option value="">— Select employee —</option>
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.full_name || e.email}
        </option>
      ))}
    </select>
  );
}
