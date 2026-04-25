import React, { useEffect, useState } from 'react';
import api from '../api';

export default function EmployeeSelect({ value, onChange, style }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('EmployeeSelect - Fetching employees...');
    api.get('/auth/profiles')
      .then(({ data }) => {
        console.log('EmployeeSelect - Raw profiles data:', data);
        
        // Filter only employees and show only names
        const employeeList = data?.filter(p => p.role === 'employee') || [];
        console.log('EmployeeSelect - Filtered employees:', employeeList);
        
        setEmployees(employeeList);
        setLoading(false);
      })
      .catch(err => {
        console.error('EmployeeSelect - Failed to fetch employees:', err);
        console.error('EmployeeSelect - Error details:', err.response?.data);
        setEmployees([]);
        setLoading(false);
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
