"use client";

import { useState } from "react";

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
};

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 1, name: "Sanya Nimit", phone: "0891234567", email: "sanya@example.com" },
  { id: 2, name: "Natthaphat K.", phone: "0812345678", email: "nat@example.com" },
  { id: 3, name: "Wiriya S.", phone: "0823456789", email: "wiriya@example.com" },
];

const EMPTY_FORM = { name: "", phone: "", email: "" };

export default function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowModal(true);
  }

  function openEdit(c: Customer) {
    setForm({ name: c.name, phone: c.phone, email: c.email });
    setEditId(c.id);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    if (!form.name.trim() || !form.phone.trim()) return;
    if (editId !== null) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === editId ? { ...c, ...form } : c))
      );
    } else {
      const newId = Math.max(0, ...customers.map((c) => c.id)) + 1;
      setCustomers((prev) => [...prev, { id: newId, ...form }]);
    }
    closeModal();
  }

  function handleDelete(id: number) {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setDeleteId(null);
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-800 tracking-tight">
            Customer Management
          </h1>
          <p className="text-sm text-stone-400 mt-0.5">{customers.length} customers total</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Add Customer
        </button>
      </header>

      <main className="px-8 py-6 max-w-5xl mx-auto">
        {/* Search */}
        <div className="mb-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, or email..."
            className="w-full max-w-sm border border-stone-200 bg-white rounded-lg px-4 py-2.5 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>

        {/* Table */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left text-stone-500 font-medium px-5 py-3.5">#</th>
                <th className="text-left text-stone-500 font-medium px-5 py-3.5">Name</th>
                <th className="text-left text-stone-500 font-medium px-5 py-3.5">Phone</th>
                <th className="text-left text-stone-500 font-medium px-5 py-3.5">Email</th>
                <th className="text-right text-stone-500 font-medium px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-stone-400 py-12">
                    No customers found.
                  </td>
                </tr>
              )}
              {filtered.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                >
                  <td className="px-5 py-4 text-stone-400 tabular-nums">{i + 1}</td>
                  <td className="px-5 py-4 font-medium text-stone-800">{c.name}</td>
                  <td className="px-5 py-4 text-stone-600 tabular-nums">{c.phone}</td>
                  <td className="px-5 py-4 text-stone-500">{c.email || "—"}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="text-xs font-medium text-stone-600 hover:text-stone-800 border border-stone-200 hover:border-stone-300 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-stone-800 mb-5">
              {editId !== null ? "Edit Customer" : "Add Customer"}
            </h2>

            <div className="space-y-4">
              {(["name", "phone", "email"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                    {field}
                    {field !== "email" && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <input
                    type={field === "email" ? "email" : "text"}
                    value={form[field]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-300"
                    placeholder={field === "name" ? "Full name" : field === "phone" ? "0812345678" : "email@example.com"}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.phone.trim()}
                className="flex-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {editId !== null ? "Save Changes" : "Add Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-xl">!</span>
            </div>
            <h2 className="text-base font-semibold text-stone-800 mb-1">Delete Customer</h2>
            <p className="text-sm text-stone-500 mb-6">
              Are you sure? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
