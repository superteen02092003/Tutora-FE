import { SearchIcon } from './icons';
import { trendingTags } from './constants';

interface SearchHeroProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onSearch: () => void;
  onTrendingClick: (tag: string) => void;
}

const SearchHero = ({ searchTerm, onSearchTermChange, onSearch, onTrendingClick }: SearchHeroProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <section className="search-hero">
      <div className="search-hero-gradient"></div>
      <div className="search-hero-content">
        <div className="search-hero-text">
          <h1 className="search-hero-title">
            Hôm nay bạn muốn <span className="highlight">khai phá tri thức</span> gì?
          </h1>
          <p className="search-hero-subtitle">
            Kể cho TopTutor nghe về mục tiêu học tập của bạn, chúng tôi sẽ tìm người đồng hành phù hợp nhất.
          </p>
        </div>
        <div className="search-container">
          <div className="search-bar">
            <div className="search-icon">
              <SearchIcon />
            </div>
            <input
              type="text"
              className="search-input"
              placeholder="Tìm gia sư toán, luyện thi đại học..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="btn-search" onClick={onSearch}>
              Tìm kiếm
            </button>
          </div>
          <div className="trending-container">
            <span className="trending-label">Trending:</span>
            {trendingTags.map((tag, index) => (
              <button
                key={index}
                className={`trending-tag ${index === 0 ? '' : 'muted'}`}
                onClick={() => onTrendingClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SearchHero;
