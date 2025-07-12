/**
 * VoidRaft - Changelog Script
 * Fetches release information from GitHub API with Gitea fallback
 */
document.addEventListener('DOMContentLoaded', () => {
  // Repository information
  const REPOS = {
    github: {
      owner: 'landaiqing',
      name: 'voidraft',
      apiUrl: 'https://api.github.com/repos/landaiqing/voidraft/releases',
      releasesUrl: 'https://github.com/landaiqing/voidraft/releases'
    },
    gitea: {
      owner: 'landaiqing',
      name: 'voidraft',
      domain: 'git.landaiqing.cn',
      apiUrl: 'https://git.landaiqing.cn/api/v1/repos/landaiqing/voidraft/releases',
      releasesUrl: 'https://git.landaiqing.cn/landaiqing/voidraft/releases'
    }
  };
  
  // Error messages with i18n support
  const MESSAGES = {
    loading: {
      en: 'Loading releases...',
      zh: '正在加载版本信息...'
    },
    noReleases: {
      en: 'No release information found',
      zh: '没有找到版本发布信息'
    },
    fetchError: {
      en: 'Failed to load release information. Please try again later.',
      zh: '无法获取版本信息，请稍后再试'
    },
    githubApiError: {
      en: 'GitHub API returned an error status: ',
      zh: 'GitHub API返回错误状态: '
    },
    giteaApiError: {
      en: 'Gitea API returned an error status: ',
      zh: 'Gitea API返回错误状态: '
    },
    dataSource: {
      en: 'Data source: ',
      zh: '数据来源: '
    },
    downloads: {
      en: 'Downloads',
      zh: '下载资源'
    },
    download: {
      en: 'Download',
      zh: '下载'
    },
    preRelease: {
      en: 'Pre-release',
      zh: '预发布'
    }
  };
  
  // Element references
  const elements = {
    loading: document.getElementById('loading'),
    changelog: document.getElementById('changelog'),
    error: document.getElementById('error-message')
  };
  
  // Initialize
  init();
  
  /**
   * Initialize the changelog
   */
  function init() {
    // Try GitHub API first
    fetchReleases('github')
      .catch(() => fetchReleases('gitea'))
      .catch(error => {
        elements.loading.style.display = 'none';
        showError(MESSAGES.fetchError[getCurrentLang()]);
      });
  }
  
  /**
   * Get current language
   */
  function getCurrentLang() {
    return window.currentLang || 'en';
  }
  
  /**
   * Fetch releases from specified source
   * @param {string} source - 'github' or 'gitea'
   */
  async function fetchReleases(source) {
    const apiUrl = REPOS[source].apiUrl;
    const errorMessageKey = source === 'github' ? 'githubApiError' : 'giteaApiError';
    
    // Setup timeout for GitHub
    const options = {
      headers: { 'Accept': 'application/json' }
    };
    
    if (source === 'github') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      options.signal = controller.signal;
      options.headers['Accept'] = 'application/vnd.github.v3+json';
      
      try {
        const response = await fetch(apiUrl, options);
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`${MESSAGES[errorMessageKey][getCurrentLang()]}${response.status}`);
        }
        
        const releases = await response.json();
        
        if (!releases || releases.length === 0) {
          throw new Error(MESSAGES.noReleases[getCurrentLang()]);
        }
        
        // Display releases
        elements.loading.style.display = 'none';
        displayReleases(releases, source);
        elements.changelog.style.display = 'block';
        
        return releases;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } else {
      const response = await fetch(apiUrl, options);
      
      if (!response.ok) {
        throw new Error(`${MESSAGES[errorMessageKey][getCurrentLang()]}${response.status}`);
      }
      
      const releases = await response.json();
      
      // Hide loading indicator
      elements.loading.style.display = 'none';
      
      if (!releases || releases.length === 0) {
        throw new Error(MESSAGES.noReleases[getCurrentLang()]);
      }
      
      // Display releases
      displayReleases(releases, source);
      elements.changelog.style.display = 'block';
      
      return releases;
    }
  }
  
  /**
   * Show error message
   */
  function showError(message) {
    const errorMessageElement = elements.error.querySelector('p');
    errorMessageElement.textContent = message;
    elements.error.style.display = 'block';
  }
  
  /**
   * Display releases
   * @param {Array} releases - Array of release objects
   * @param {string} source - 'github' or 'gitea'
   */
  function displayReleases(releases, source) {
    // Clear existing content
    elements.changelog.innerHTML = '';
    
    // Add data source indicator
    const sourceElement = createSourceElement(source);
    elements.changelog.appendChild(sourceElement);
    
    // Create release elements
    releases.forEach(release => {
      const releaseElement = createReleaseElement(release, source);
      elements.changelog.appendChild(releaseElement);
    });
  }
  
  /**
   * Create source element
   */
  function createSourceElement(source) {
    const sourceElement = document.createElement('div');
    sourceElement.className = 'data-source';
    
    // Create source label with i18n support
    const sourceLabel = document.createElement('span');
    sourceLabel.setAttribute('data-en', MESSAGES.dataSource.en);
    sourceLabel.setAttribute('data-zh', MESSAGES.dataSource.zh);
    sourceLabel.textContent = MESSAGES.dataSource[getCurrentLang()];
    
    // Create link
    const sourceLink = document.createElement('a');
    sourceLink.href = REPOS[source].releasesUrl;
    sourceLink.textContent = source === 'github' ? 'GitHub' : 'Gitea';
    sourceLink.target = '_blank';
    
    // Assemble elements
    sourceElement.appendChild(sourceLabel);
    sourceElement.appendChild(sourceLink);
    
    return sourceElement;
  }
  
  /**
   * Create release element
   * @param {Object} release - Release data
   * @param {string} source - 'github' or 'gitea'
   */
  function createReleaseElement(release, source) {
    const releaseElement = document.createElement('div');
    releaseElement.className = 'release';
    
    // Format release date
    const releaseDate = new Date(release.published_at || release.created_at);
    const formattedDate = formatDate(releaseDate);
    
    // Create header
    const headerElement = createReleaseHeader(release, formattedDate);
    releaseElement.appendChild(headerElement);
    
    // Add release description
    if (release.body) {
      const descriptionElement = document.createElement('div');
      descriptionElement.className = 'release-description markdown-content';
      descriptionElement.innerHTML = parseMarkdown(release.body);
      releaseElement.appendChild(descriptionElement);
    }
    
    // Add download assets
    const assets = getAssetsFromRelease(release, source);
    if (assets && assets.length > 0) {
      const assetsElement = createAssetsElement(assets);
      releaseElement.appendChild(assetsElement);
    }
    
    return releaseElement;
  }
  
  /**
   * Create release header
   */
  function createReleaseHeader(release, formattedDate) {
    const headerElement = document.createElement('div');
    headerElement.className = 'release-header';
    
    // Version element
    const versionElement = document.createElement('div');
    versionElement.className = 'release-version';
    
    // Version text
    const versionText = document.createElement('span');
    versionText.textContent = release.name || release.tag_name;
    versionElement.appendChild(versionText);
    
    // Pre-release badge
    if (release.prerelease) {
      const preReleaseTag = document.createElement('span');
      preReleaseTag.className = 'release-badge pre-release';
      preReleaseTag.setAttribute('data-en', MESSAGES.preRelease.en);
      preReleaseTag.setAttribute('data-zh', MESSAGES.preRelease.zh);
      preReleaseTag.textContent = MESSAGES.preRelease[getCurrentLang()];
      versionElement.appendChild(preReleaseTag);
    }
    
    // Date element
    const dateElement = document.createElement('div');
    dateElement.className = 'release-date';
    dateElement.textContent = formattedDate;
    
    headerElement.appendChild(versionElement);
    headerElement.appendChild(dateElement);
    
    return headerElement;
  }
  
  /**
   * Get assets from release based on source
   */
  function getAssetsFromRelease(release, source) {
    let assets = [];
    
    if (source === 'github') {
      assets = release.assets || [];
    } else { // Gitea
      assets = release.assets || [];
      // Check for Gitea-specific asset structure
      if (!assets.length && release.attachments) {
        assets = release.attachments.map(attachment => ({
          name: attachment.name,
          size: attachment.size,
          browser_download_url: attachment.browser_download_url
        }));
      }
    }
    
    return assets;
  }
  
  /**
   * Create assets element
   */
  function createAssetsElement(assets) {
    const assetsElement = document.createElement('div');
    assetsElement.className = 'release-assets';
    
    // Assets title
    const assetsTitle = document.createElement('div');
    assetsTitle.className = 'release-assets-title';
    assetsTitle.setAttribute('data-en', MESSAGES.downloads.en);
    assetsTitle.setAttribute('data-zh', MESSAGES.downloads.zh);
    assetsTitle.textContent = MESSAGES.downloads[getCurrentLang()];
    
    // Asset list
    const assetList = document.createElement('ul');
    assetList.className = 'asset-list';
    
    // Add each asset
    assets.forEach(asset => {
      const assetItem = createAssetItem(asset);
      assetList.appendChild(assetItem);
    });
    
    assetsElement.appendChild(assetsTitle);
    assetsElement.appendChild(assetList);
    
    return assetsElement;
  }
  
  /**
   * Create asset item
   */
  function createAssetItem(asset) {
    const assetItem = document.createElement('li');
    assetItem.className = 'asset-item';
    
    // File icon
    const iconElement = document.createElement('i');
    iconElement.className = `asset-icon fas fa-${getFileIcon(asset.name)}`;
    
    // File name
    const nameElement = document.createElement('span');
    nameElement.className = 'asset-name';
    nameElement.textContent = asset.name;
    
    // File size
    const sizeElement = document.createElement('span');
    sizeElement.className = 'asset-size';
    sizeElement.textContent = formatFileSize(asset.size);
    
    // Download link
    const downloadLink = document.createElement('a');
    downloadLink.className = 'download-btn';
    downloadLink.href = asset.browser_download_url;
    downloadLink.target = '_blank';
    downloadLink.setAttribute('data-en', MESSAGES.download.en);
    downloadLink.setAttribute('data-zh', MESSAGES.download.zh);
    downloadLink.textContent = MESSAGES.download[getCurrentLang()];
    
    // Assemble asset item
    assetItem.appendChild(iconElement);
    assetItem.appendChild(nameElement);
    assetItem.appendChild(sizeElement);
    assetItem.appendChild(downloadLink);
    
    return assetItem;
  }
  
  /**
   * Get file icon based on extension
   */
  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    switch (ext) {
      case 'zip':
      case 'gz':
      case 'tar':
      case '7z':
        return 'file-archive';
      case 'exe':
        return 'file-code';
      case 'dmg':
        return 'apple';
      case 'deb':
      case 'rpm':
        return 'linux';
      case 'json':
      case 'xml':
        return 'file-alt';
      default:
        return 'file';
    }
  }
  
  /**
   * Format file size
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Format date
   */
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  
  /**
   * Simple Markdown parser
   * Note: This is a very basic implementation that handles only common Markdown syntax
   */
  function parseMarkdown(markdown) {
    if (!markdown) return '';
    
    // Links - [text](url)
    markdown = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Headings - # Heading
    markdown = markdown.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    markdown = markdown.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    markdown = markdown.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Bold - **text**
    markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic - *text*
    markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks - ```code```
    markdown = markdown.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code - `code`
    markdown = markdown.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Lists - * item
    markdown = markdown.replace(/^\* (.*$)/gm, '<ul><li>$1</li></ul>');
    
    // Lists - 1. item
    markdown = markdown.replace(/^\d+\. (.*$)/gm, '<ol><li>$1</li></ol>');
    
    // Merge adjacent list items
    markdown = markdown.replace(/<\/ul>\s*<ul>/g, '');
    markdown = markdown.replace(/<\/ol>\s*<ol>/g, '');
    
    // Paragraphs - blank line
    markdown = markdown.replace(/\n\n/g, '</p><p>');
    
    // Line breaks - two spaces at end of line
    markdown = markdown.replace(/  \n/g, '<br>');
    
    return `<p>${markdown}</p>`;
  }
  
  // Update translations when language changes
  window.addEventListener('languageChanged', updateUI);
  
  // Initial UI update based on current language
  updateUI();
  
  /**
   * Update UI elements with current language
   */
  function updateUI() {
    const lang = getCurrentLang();
    
    // Update all i18n elements
    document.querySelectorAll('[data-en][data-zh]').forEach(el => {
      if (el.hasAttribute(`data-${lang}`)) {
        el.textContent = el.getAttribute(`data-${lang}`);
      }
    });
  }
}); 