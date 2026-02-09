import React from 'react';
import { ChevronRight, Calendar } from 'lucide-react';

const AssemblyListItem = ({ assembly, onSelect }) => {

  const getStatusChip = (status) => {
    let textColor, bgColor;
    switch (status) {
      case 'Pending':
        textColor = 'text-yellow-800';
        bgColor = 'bg-yellow-100';
        break;
      case 'In Progress':
        textColor = 'text-blue-800';
        bgColor = 'bg-blue-100';
        break;
      case 'QA':
        textColor = 'text-purple-800';
        bgColor = 'bg-purple-100';
        break;
      case 'Completed':
        textColor = 'text-green-800';
        bgColor = 'bg-green-100';
        break;
      default:
        textColor = 'text-gray-800';
        bgColor = 'bg-gray-100';
    }
    return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${textColor} ${bgColor}`}>{status}</span>;
  };

  return (
    <tr onClick={() => onSelect(assembly)} className="hover:bg-gray-50 transition-colors cursor-pointer">
        <td className="px-6 py-4">
            <div className="font-bold text-gray-800">{assembly.taskName}</div>
            <div className="text-sm text-gray-500">{assembly.customerName}</div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-600">{assembly.assignedTo}</td>
        <td className="px-6 py-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
                <Calendar size={14} />
                {new Date(assembly.dueDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
        </td>
        <td className="px-6 py-4 text-center">{getStatusChip(assembly.status)}</td>
        <td className="px-6 py-4 text-right">
            <ChevronRight size={20} className="text-gray-400" />
        </td>
    </tr>
  );
};

export default AssemblyListItem;
