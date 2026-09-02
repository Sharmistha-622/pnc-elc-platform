import { getEmployees } from '@/lib/employees/getEmployees'

export default async function EmployeesPage() {
  const employees = await getEmployees()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Employee Directory</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Type</th>
            <th className="text-left p-2">Team</th>
            <th className="text-left p-2">Joining Date</th>
            <th className="text-left p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id} className="border-b">
              <td className="p-2">{emp.name}</td>
              <td className="p-2">{emp.employee_type}</td>
              <td className="p-2">{emp.team || '-'}</td>
              <td className="p-2">{emp.joining_date}</td>
              <td className="p-2">{emp.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
