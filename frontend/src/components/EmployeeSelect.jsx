import React, { useEffect, useState } from 'react';
import api from '../api';

export default function EmployeeSelect({ value, onChange, style }) {
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    api.get('/auth/profiles')
      .then(({ data }) => {
        // Filter only employees and show only names
        const employeeList = data?.filter(p => p.role === 'employee') || [];
        setEmployees(employeeList);
      })
      .catch(err => {
        console.error('Failed to fetch employees:', err);
        setEmployees([]);
      });
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
