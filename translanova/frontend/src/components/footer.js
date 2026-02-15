import { Link } from 'react-router-dom';
import '../styles/variable.css';
import './footer.css';

function Footer(){
    return(
    <section className="footer">
        <div className="container-fluid">
                    <div className="row">
                        <div className="col-lg-3">
                            <h1>TranslaNova</h1>
                        </div>
                        <div className="col-lg-3">
                            <h4>Quick Links</h4>
                            <ul>
                               <li><Link to="/">Home</Link></li>
                               <li><Link to="/">Services</Link></li>
                               <li><Link to="/">About</Link></li>
                               <li><Link to="/">Testimonial</Link></li>
                               <li><Link to="/">Contact Us</Link></li>
                            </ul>
                        </div>
                        <div className="col-lg-3">
                            <h4>Stay Connected</h4>
                            <ul>
                                <li>Facebook</li>
                                <li>Twitter</li>
                                <li>Linkedin</li>
                                <li>Instagram</li>
                                <li>YouTube</li>
                            </ul>
                        </div>
                        <div className="col-lg-3">
                            <h4>Subscribe</h4>
                            <p>Join our newsletter to stay updated on features and releases.</p>
                            <form>
                                <input type="text" placeholder='Enter Your Email' className="footer_form"/><button>Subscribe</button>
                            </form>
                            <p>By subscribing, you agree to our Privacy Policy and consent to receive updates.</p>
                        </div>
                    </div>
                </div>
            </section>
    );
}

export default Footer;