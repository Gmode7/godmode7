import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../lib/utils';
import type { Project } from '../types';

export function Projects() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data.projects || []);
    } catch (err) {
      showToast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createProject({ name, description, clientId: clientId || 'default' });
      showToast('Project created successfully');
      setIsModalOpen(false);
      resetForm();
      loadProjects();
    } catch (err) {
      showToast('Failed to create project', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      setIsDeleting(id);
      await api.deleteProject(id);
      showToast('Project deleted');
      loadProjects();
    } catch (err) {
      showToast('Failed to delete project', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const resetForm = () => {
    setName('');
    setClientId('');
    setDescription('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your software development initiatives.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus size={16}/> Create Project
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6 h-48 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-white mb-2">No projects yet</h3>
          <p className="text-gray-400 mb-6">Create your first project to start the AI pipeline.</p>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={16} className="mr-2" /> Create Project
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <Card 
              key={project.id} 
              onClick={() => navigate(`/projects/${project.id}`)} 
              className="p-6 flex flex-col h-full group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-violet-500/10 text-violet-400 rounded-lg">
                  <FolderKanban size={24} />
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id);
                  }}
                  disabled={isDeleting === project.id}
                  className="text-gray-500 hover:text-rose-400 transition-colors p-1"
                >
                  {isDeleting === project.id ? '...' : <Trash2 size={18}/>}
                </button>
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-violet-400 transition-colors">{project.name}</h3>
              <p className="text-sm text-gray-400 line-clamp-2 mb-6 flex-grow">{project.description || 'No description'}</p>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-500">
                <span>Client: {project.clientId}</span>
                <span>{formatDate(project.createdAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Project">
        <form className="space-y-4" onSubmit={handleCreate}>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Project Name *</label>
            <Input 
              autoFocus 
              placeholder="e.g. Nexus Payment Gateway" 
              value={name}
              onChange={e => setName(e.target.value)}
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Client ID</label>
            <Input 
              placeholder="e.g. cli-12345" 
              value={clientId}
              onChange={e => setClientId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea 
              className="flex w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 min-h-[100px]"
              placeholder="Brief description of the project..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create Project</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
