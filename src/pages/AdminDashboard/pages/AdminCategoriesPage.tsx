import React from 'react';
import { useAdmin } from '../context/AdminContext';
import CategoriesManagementTable from '../components/CategoriesManagementTable';

export default function AdminCategoriesPage() {
  const {
    categories,
    categoryTotalCount,
    categoryPage,
    categoryTotalPages,
    categoryStatusFilter,
    categoryMonthFilter,
    setCategoryPage,
    setCategoryStatusFilter,
    setCategoryMonthFilter,
    isCategoriesLoading,
    isDeletingCategory,
    isTogglingCategoryStatus,
    handleToggleCategoryStatus,
    handleDeleteCategory,
    setIsCategoryModalOpen,
    setIsPrizeSettingsModalOpen,
    setEditingCategory,
    setPublishRoundCategory,
    setCorrectionRound,
    setReadOnlyResultCategory,
    setPoolDetailCategory,
  } = useAdmin();

  return (
    <div className="max-w-7xl mx-auto">
      <CategoriesManagementTable
        categories={categories}
        totalCount={categoryTotalCount}
        page={categoryPage}
        totalPages={categoryTotalPages}
        statusFilter={categoryStatusFilter}
        monthFilter={categoryMonthFilter}
        onPageChange={setCategoryPage}
        onStatusFilterChange={setCategoryStatusFilter}
        onMonthFilterChange={setCategoryMonthFilter}
        isLoading={isCategoriesLoading}
        onOpenNewCategory={() => { setEditingCategory(null); setIsCategoryModalOpen(true); }}
        onOpenPrizeSettings={() => setIsPrizeSettingsModalOpen(true)}
        onEditCategory={(category) => { setEditingCategory(category); setIsCategoryModalOpen(true); }}
        onPublishRound={(category) => { setCorrectionRound(null); setPublishRoundCategory(category); }}
        onViewResult={(category) => setReadOnlyResultCategory(category)}
        onViewDetails={(category) => setPoolDetailCategory(category)}
        onToggleCategoryStatus={handleToggleCategoryStatus}
        onDeleteCategory={handleDeleteCategory}
        isBusy={isDeletingCategory || isTogglingCategoryStatus}
      />
    </div>
  );
}
