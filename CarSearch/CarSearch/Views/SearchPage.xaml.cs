using CarSearch.ViewModels;

namespace CarSearch.Views
{
    public partial class SearchPage : ContentPage
    {
        public SearchPage()
        {
            InitializeComponent();
        }

        private void OnClearClicked(object sender, EventArgs e)
        {
            if (BindingContext is SearchViewModel vm)
                vm.Clear();
        }
    }
}
