import React from 'react';
import './contact_us.css';

function ContactUs(){
    return(
        <section className="home_sect6">
            <div className="container">
                <div className="row">
                    <div className="col-lg-12">
                        <div className="sect6_div1">
                            <div className="sect6_div2">
                                <div className="row">
                                    <div className="col-lg-6">
                                        <div className="sect6_content">
                                            <h4>Connect</h4>
                                            <h1>Get in Touch</h1>
                                            <p>We’re here to assist you with any inquiries or support you may need.`</p>
                                        </div>
                                    </div>
                                    <div className="col-lg-6">
                                        <div className="sect6_details">
                                            <ul className="contact-list">
                                                <li>
                                                    <i className="fa fa-envelope-o" aria-hidden="true" /> <strong>Email</strong>
                                                    <div>
                                                        <p>support@translanova.com</p>
                                                    </div>
                                                </li>
                                                <li>
                                                    <i className="fa fa-phone" aria-hidden="true" /> <strong>Phone</strong>
                                                    <div>
                                                        <p>+91 7718874493</p>
                                                    </div>
                                                </li>
                                                <li>
                                                    <i className="fa fa-map-marker" aria-hidden="true" /> <strong>Office</strong>
                                                    <div>
                                                        <p>F-704,Shraddha Evoque,Bhandup West, Mumbai-400078</p>
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default ContactUs;